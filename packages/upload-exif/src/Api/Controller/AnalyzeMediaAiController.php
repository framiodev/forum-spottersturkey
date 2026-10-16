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

class AnalyzeMediaAiController implements RequestHandlerInterface
{
    public function __construct(protected SettingsRepositoryInterface $settings, protected VisionAnalyzer $vision)
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
                "Sen ulaşım araçları (otobüs, şehir içi otobüs, metrobüs, kamyon, tren, uçak, tramvay, gemi vb.) konusunda uzman bir yapay zeka asistanısın.\n"
                . "Bu görseldeki aracı analiz et ve aşağıdaki JSON şemasına birebir uygun yanıt ver:\n"
                . "{\n"
                . "  \"company\": \"Araç üzerindeki firma, operatör veya belediye/kurum adı (Örn: Varan, Kamil Koç, Metro Turizm, ESHOT, İETT, Pamukkale, Ali Osman Ulusoy, THY, TCDD vb. Okunamıyorsa veya yoksa boş bırak)\",\n"
                . "  \"plate\": \"Araç plakası (Örn: 34 CDL 37, 06 ABC 123. Uçaksa tescil kodu TC-xxx, trense lokomotif no. Net okunamıyorsa boş bırak)\",\n"
                . "  \"brand\": \"Araç markası (Örn: Mercedes-Benz, MAN, Setra, Otokar, BMC, Temsa, Isuzu, Scania, Volvo, Ford, Boeing, Airbus)\",\n"
                . "  \"model\": \"Araç modeli (Örn: Tourismo 16 RHD, Travego 15 SHD, Conecto, Lion's Coach, Kent LF, Avenue, Citibus, Tourliner)\",\n"
                . "  \"location_guess\": \"Aracın bulunduğu şehir veya terminal/otogar adı (Örn: Ankara, İstanbul, İzmir, Bursa Otogar vb.)\",\n"
                . "  \"year_guess\": \"Tahmini üretim yılı veya model yılı (Örn: 2024, 2022)\"\n"
                . "}\n"
                . "SADECE geçerli bir JSON döndür. Markdown etiketleri (```json vb.) veya ek açıklama yazma."
            );
        }

        try {
            $result = $this->vision->analyze($candidates, $bytes, $mimeType, $promptText);
        } catch (\Throwable $e) {
            return new JsonResponse(['success' => false, 'error' => 'Yapay zeka yanıt veremedi: ' . $e->getMessage()]);
        }

        return new JsonResponse([
            'success' => true,
            'provider' => $result['provider'],
            'model' => $result['model'],
            'source' => $result['source'],
            'cached' => $result['cached'],
            'ms' => $result['ms'],
            'data' => $result['data'],
        ]);
    }
}
