<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Flarum\Settings\SettingsRepositoryInterface;
use GuzzleHttp\Client;
use Illuminate\Support\Arr;
use Framio\UploadExif\Ai\VisionAnalyzer;
use Framio\UploadExif\Ai\VisionHistory;

class AnalyzeMediaAiController implements RequestHandlerInterface
{
    public function __construct(protected SettingsRepositoryInterface $settings, protected VisionAnalyzer $vision, protected VisionHistory $history)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $body = $request->getParsedBody() ?: [];
        $file = $request->getUploadedFiles()['image'] ?? null;
        $imageUrl = Arr::get($body, 'image_url');

        // Yapılandırılmamış ya da kapalıysa sessizce geç: yükleme akışı etkilenmez
        if (!$this->vision->enabled()) {
            return new JsonResponse(['success' => false, 'reason' => 'disabled']);
        }
        $candidates = $this->vision->candidates($actor);
        if (!$candidates) {
            return new JsonResponse(['success' => false, 'reason' => 'not_configured']);
        }

        $bytes = null;
        $mimeType = 'image/jpeg';
        if ($file && $file->getError() === UPLOAD_ERR_OK) {
            $bytes = (string) $file->getStream();
            $mimeType = $file->getClientMediaType() ?: $mimeType;
        } elseif ($imageUrl && preg_match('#^https?://#i', $imageUrl)) {
            try {
                $bytes = (string) (new Client(['timeout' => 5.0]))->get($imageUrl)->getBody();
            } catch (\Throwable $e) {
                return new JsonResponse(['success' => false, 'error' => 'Görsel adresinden alınamadı.']);
            }
        }
        if (!$bytes) {
            return new JsonResponse(['success' => false, 'error' => 'Analiz edilecek görsel bulunamadı.']);
        }

        // Kategori Şeması Tespiti (tag_slug veya discussion_id üzerinden)
        $tagSlug = Arr::get($body, 'tag_slug');
        $discussionId = Arr::get($body, 'discussion_id');
        $schema = null;

        if ($discussionId) {
            $schemas = \Framio\UploadExif\Database\MediaCategorySchema::all();
            foreach ($schemas as $s) {
                $tagSlugs = $s->tag_slugs;
                if (is_array($tagSlugs) && in_array('url:' . $discussionId, $tagSlugs)) {
                    $schema = $s;
                    break;
                }
            }
        }

        if (!$schema && $tagSlug) {
            $schemas = \Framio\UploadExif\Database\MediaCategorySchema::all();
            foreach ($schemas as $s) {
                $tagSlugs = $s->tag_slugs;
                if (is_array($tagSlugs) && in_array($tagSlug, $tagSlugs)) {
                    $schema = $s;
                    break;
                }
            }
            if (!$schema) {
                $tag = \Flarum\Tags\Tag::where('slug', $tagSlug)->first();
                if ($tag && $tag->parent_id) {
                    $parentTag = \Flarum\Tags\Tag::find($tag->parent_id);
                    if ($parentTag) {
                        foreach ($schemas as $s) {
                            $tagSlugs = $s->tag_slugs;
                            if (is_array($tagSlugs) && in_array($parentTag->slug, $tagSlugs)) {
                                $schema = $s;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Dinamik veya Varsayılan Prompt Hazırlama
        $fieldsConfig = $schema ? $schema->fields_config : null;
        if (is_string($fieldsConfig)) {
            $fieldsConfig = json_decode($fieldsConfig, true);
        }

        if (!empty($fieldsConfig) && is_array($fieldsConfig)) {
            $schemaFieldsPrompt = [];
            foreach ($fieldsConfig as $f) {
                $key = $f['key'] ?? '';
                $label = $f['label'] ?? $key;
                if (empty($key)) continue;

                // Alan bazlı AI sorusu/talimatı varsa onu kullan
                $aiInstruction = !empty($f['ai_prompt']) ? trim($f['ai_prompt']) : null;
                if (!$aiInstruction) {
                    // Varsayılan alan açıklamaları
                    switch ($key) {
                        case 'company':
                            $aiInstruction = 'Araç üzerindeki firma, operatör veya kurum adı (Örn: Varan, Kamil Koç, ESHOT, İETT, THY, TCDD). Bulunamazsa boş bırak.';
                            break;
                        case 'plate':
                            $aiInstruction = 'Araç plakası (Örn: 34 ABC 123, 06 CDL 37. Uçaksa TC-xxx kuyruk tescili, trense lokomotif no). Net değilse boş bırak.';
                            break;
                        case 'brand':
                            $aiInstruction = 'Araç markası (Örn: Mercedes-Benz, MAN, Setra, Otokar, BMC, Temsa, Boeing, Airbus).';
                            break;
                        case 'model':
                            $aiInstruction = 'Araç modeli (Örn: Tourismo 16 RHD, Travego 15 SHD, Conecto, Lion\'s Coach, B737-800).';
                            break;
                        case 'location':
                        case 'location_guess':
                            $aiInstruction = 'Aracın bulunduğu şehir, otogar, havalimanı veya gar (Örn: Ankara AŞTİ, İstanbul Otogarı, İGA).';
                            break;
                        case 'year':
                        case 'year_guess':
                            $aiInstruction = 'Aracın tahmini model/üretim yılı (Örn: 2024, 2022).';
                            break;
                        case 'city':
                            $aiInstruction = 'Aracın bağlı olduğu veya bulunduğu şehir adı (Örn: Ankara, İstanbul, İzmir).';
                            break;
                        case 'route':
                            $aiInstruction = 'Hat numarası veya güzergah (Örn: 504, 104-1, Kadıköy-Tavşantepe).';
                            break;
                        case 'fleetCode':
                            $aiInstruction = 'Araç kapı/filo numarası (Örn: 06-1234, M-105).';
                            break;
                        default:
                            $aiInstruction = "Görselden '{$label}' bilgisini tespit et. Bulunamazsa boş bırak.";
                            break;
                    }
                }

                $schemaFieldsPrompt[] = "  \"{$key}\": \"{$aiInstruction}\"";
            }

            $fieldsJsonExample = "{\n" . implode(",\n", $schemaFieldsPrompt) . "\n}";
            $categoryName = $schema->name ?? 'Ulaşım Aracı';
            $promptText = "Sen '{$categoryName}' kategorisindeki ulaşım araçları ve fotoğrafları konusunda uzman bir yapay zeka analiz motorusun.\n"
                . "Bu görseli incele ve doğrudan aşağıdaki JSON şemasına uygun yanıt üret:\n"
                . $fieldsJsonExample . "\n"
                . "SADECE geçerli bir JSON formatında yanıt ver. Markdown etiketleri (```json vb.) veya fazladan metin ekleme.";
        } else {
            $customPrompt = $this->settings->get('framio-upload-exif.ai_custom_prompt');
            $promptText = !empty($customPrompt) ? $customPrompt : (
                "Türkiye'deki ulaşım araçları (şehirlerarası/turizm otobüsü, şehir içi otobüs, kamyon, tren, uçak vb.) fotoğraflarını tanıyan bir uzmansın.\n"
                . "Görseldeki ANA aracı incele ve yalnızca şu JSON'u döndür:\n"
                . "{\n"
                . "  \"company\": \"Araç gövdesinde yazan firma / kurum adının TAMAMI\",\n"
                . "  \"plate\": \"Plaka, ör. 34 ABC 123\",\n"
                . "  \"brand\": \"Marka\",\n"
                . "  \"model\": \"Model (marka adı olmadan)\",\n"
                . "  \"location_guess\": \"Çekim yeri\",\n"
                . "  \"year_guess\": \"Model yılı\"\n"
                . "}\n"
            );
        }
        $promptText .= "\nKURALLAR:\n"
            . "- Firma: en büyük logo/kelimeyi değil, gövdede yazan resmî adın tamamını yaz (ör. logoda 'Anka' yazsa da yan yüzde 'Adıyaman Anka Turizm' yazıyorsa onu yaz). Şehir ön eki, 'Turizm', 'Seyahat', 'Taşımacılık' gibi kelimeleri atma.\n"
            . "- Model: ön/arka maske, far, cam ve yan pencere dizilimine bakarak tam modeli belirle (ör. Mercedes-Benz Travego 15 SHD, Tourismo 16 RHD, Setra S 516 HD, MAN Lion's Coach, Temsa Maraton). Aşağıdaki forum listesinde uygun bir ad varsa birebir o yazımı kullan.\n"
            . "- Çekim yeri: yalnızca fotoğrafta GÖRÜNEN bir tabela, otogar, tesis, yol işareti veya bilinen yapıdan kesin anlaşılıyorsa yaz. Plakanın il kodundan ya da firma adındaki şehirden ÇIKARIM YAPMA. Emin değilsen boş bırak.\n"
            . "- Yıl: yalnızca kasa nesli kesin biliniyorsa tahmin et, yoksa boş bırak.\n"
            . "- Okuyamadığın ya da emin olmadığın her alanı boş string bırak; uydurma.\n"
            . "SADECE geçerli JSON döndür, açıklama ekleme.";

        $useHistory = $this->history->appliesTo($discussionId ? (int) $discussionId : null, $tagSlug ?: null);
        if ($useHistory && ($known = $this->history->knownModels())) {
            $lines = [];
            foreach ($known as $brand => $models) {
                $lines[] = $brand . ': ' . implode(', ', $models);
            }
            $promptText .= "\n\nForumda kullanılan model adları:\n" . mb_substr(implode("\n", $lines), 0, 2500);
        }

        try {
            $result = $this->vision->analyze($candidates, $bytes, $mimeType, $promptText);
        } catch (\Throwable $e) {
            return new JsonResponse(['success' => false, 'error' => 'Yapay zeka yanıt veremedi: ' . $e->getMessage()]);
        }

        $data = $this->dropGuessedLocation($result['data']);
        $notes = [];
        if ($useHistory) {
            ['data' => $data, 'notes' => $notes] = $this->history->enrich($data);
        }

        return new JsonResponse([
            'success' => true,
            'history' => $notes,
            'provider' => $result['provider'],
            'model' => $result['model'],
            'source' => $result['source'],
            'cached' => $result['cached'],
            'ms' => $result['ms'],
            'data' => $data,
        ]);
    }

    protected const PLATE_CITIES = [1 => 'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin', 'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce'];

    /** Çekim yeri yalnızca plakanın ili ya da firma adındaki şehirse tahmindir: at */
    protected function dropGuessedLocation(array $data): array
    {
        $low = fn ($s) => mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], trim((string) $s)), 'UTF-8');
        foreach (['location', 'location_guess', 'city'] as $k) {
            if (empty($data[$k])) continue;
            $loc = $low($data[$k]);
            $plateCity = preg_match('/^(\d{2})/', trim((string) ($data['plate'] ?? '')), $m) ? (self::PLATE_CITIES[(int) $m[1]] ?? '') : '';
            if (($plateCity && $loc === $low($plateCity)) || (!empty($data['company']) && str_contains($low($data['company']), $loc))) {
                unset($data[$k]);
            }
        }

        return $data;
    }
}
