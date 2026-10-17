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
    public function __construct(protected SettingsRepositoryInterface $settings, protected VisionAnalyzer $vision, protected VisionHistory $history, protected \Framio\UploadExif\Ai\VisionSimilarity $similarity, protected \Framio\UploadExif\Ai\VisionLocation $location)
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
                . "  \"model\": \"Model (marka adı olmadan)\"\n"
                . "}\n"
            );
        }
        $detailed = $this->location->detailed($discussionId ? (int) $discussionId : null, $tagSlug ?: null);
        $knownPlaces = $this->location->knownPlaces();
        $locationRule = $this->locationRule($detailed, $knownPlaces);

        $promptText .= "\nKURALLAR:\n"
            . "- Firma: en büyük logo/kelimeyi değil, gövdede yazan resmî adın tamamını yaz (ör. logoda 'Anka' yazsa da yan yüzde 'Adıyaman Anka Turizm' yazıyorsa onu yaz). Şehir ön eki, 'Turizm', 'Seyahat', 'Taşımacılık' gibi kelimeleri atma.\n"
            . "- Model: ön/arka maske, far, cam ve yan pencere dizilimine bakarak tam modeli belirle (ör. Mercedes-Benz Travego 15 SHD, Tourismo 16 RHD, Setra S 516 HD, MAN Lion's Coach, Temsa Maraton). Aşağıdaki forum listesinde uygun bir ad varsa birebir o yazımı kullan.\n"
            . self::MODEL_CUES
            . $locationRule
            . "- JSON'a ayrıca \"subject\" ekle: fotoğrafın ANA konusu araçsa \"vehicle\"; ön planda insan/portre varsa \"person\"; araç içi \"interior\"; yakın detay (logo, far, jant) \"detail\"; diğer \"other\".\n"
            . "- Okuyamadığın ya da emin olmadığın her alanı boş string bırak; uydurma.\n"
            . "SADECE geçerli JSON döndür, açıklama ekleme.";

        $useHistory = $this->history->appliesTo($discussionId ? (int) $discussionId : null, $tagSlug ?: null);
        $known = $useHistory ? $this->history->knownModels() : [];
        foreach ((array) json_decode((string) $this->settings->get('framio-upload-exif.assistant_model_map'), true) as $row) {
            // Yöneticinin tanımladığı Marka + Model adları her zaman listede (yapay zeka bu yazımı kullanır)
            if (!empty($row['brand']) && !empty($row['model']) && !in_array($row['model'], $known[$row['brand']] ?? [], true)) {
                $known[$row['brand']] = array_merge([$row['model']], $known[$row['brand']] ?? []);
            }
        }
        if ($known) {
            $lines = [];
            foreach ($known as $brand => $models) {
                $lines[] = $brand . ': ' . implode(', ', $models);
            }
            $promptText .= "\n\nForumda kullanılan model adları:\n" . mb_substr(implode("\n", $lines), 0, 2500);
        }

        // EXIF (tarayıcı küçültmeden önce dosyanın başını ayrıca gönderir): GPS ve çekim zamanı
        $head = $request->getUploadedFiles()['exif_head'] ?? null;
        $exif = $this->location->readExif($head && $head->getError() === UPLOAD_ERR_OK ? (string) $head->getStream() : $bytes);

        // Yapay zeka isteğiyle eşzamanlı yan işler: görsel benzerlik, konuma özel soru, GPS ters adres
        // Görsel benzerlik YALNIZCA çekim yeri için kullanılır (firma/plaka/marka/model asla)
        $similarityOn = $this->similarity->available();
        $geoCandidate = $this->geoCandidate($candidates);
        // Kullanıcının son 2 saatteki künyeli fotoğrafları: dizine girmemiş olsalar da aynı yerde art arda çekimler yakalanır
        $recent = $similarityOn ? $this->location->recentUserImages((int) $actor->id) : [];
        $modelList = !empty($lines) ? "Forumda kullanılan model adları (uygunsa birebir bu yazımı kullan):\n" . mb_substr(implode("\n", $lines), 0, 2500) . "\n" : '';
        $parallel = function ($client, $original, $b64, $mime) use ($similarityOn, $geoCandidate, $exif, $locationRule, $recent, $modelList) {
            $jobs = [];
            if ($similarityOn) {
                // Sahne (arka plan şeridi) parmak izi: araçtan bağımsız, çekim yeri hafızası
                // Araç benzerliği (tüm kare): forumdaki %95+ benzer gönderilerin marka/modeli
                $jobs['vehicle_sim'] = $this->similarity->embedAsync($client, $original, false)
                    ->then(fn ($vec) => $this->similarity->nearestMany($vec, 5, 'vec'));
                $jobs['similar'] = $this->similarity->embedAsync($client, $original, true)
                    ->then(fn ($vec) => ['vec' => $vec, 'nearest' => $this->similarity->nearestMany($vec, 5, 'scene_vec')]);
                foreach ($recent as $i => $r) {
                    $jobs['recent' . $i] = $client->getAsync($r['fetch_url'], ['timeout' => 2])
                        ->then(fn ($res) => $this->similarity->embedAsync($client, (string) $res->getBody(), true));
                }
            }
            if ($exif['lat'] !== null) {
                $jobs['gps'] = $this->location->reverseAsync($client, $exif['lat'], $exif['lon']);
            } elseif ($geoCandidate) {
                $jobs['geo'] = $this->vision->askAsync($client, $geoCandidate, $b64, $mime,
                    "Bu ulaşım fotoğrafının Türkiye'de NEREDE çekildiğini bul. Arka plandaki binalara, otogar/peron mimarisine, tabelalara, dağ/deniz/şehir siluetine, yol ve tesis yapısına bak.\n"
                    . "Yalnızca şu JSON'u döndür: {\"city\": \"il\", \"place\": \"yer\", \"location_confidence\": \"high|medium|low\"}\n" . $locationRule
                    . "SADECE JSON.");
            }

            // Model doğrulama: güçlü modele yalnızca marka/model sorulur (hızlı yarışı kazanan zayıf modelin hatasını düzeltir)
            if ($geoCandidate) {
                $jobs['vehicle'] = $this->vision->askAsync($client, ['deep' => $this->vision->accurate()] + $geoCandidate, $b64, $mime,
                    "Bu fotoğraftaki ana aracın markasını ve TAM modelini belirle. Ön/arka maske, far biçimi, ızgara, tavan çizgisi ve yan pencere dizilimine dikkatle bak.\n"
                    . self::MODEL_CUES . $modelList
                    . "Yalnızca şu JSON'u döndür: {\"brand\": \"\", \"model\": \"marka adı olmadan\", \"confidence\": \"high|medium|low\"}. SADECE JSON.", $this->vision->accurate() ? 30.0 : 7.0);
            }

            return $jobs;
        };

        try {
            // quick=1: asistanın toplu taraması — yalnızca hızlı yanıt (plaka, firma, marka, model, konu); yan işler yapılmaz
            $quick = (bool) Arr::get($body, 'quick');
            $this->vision->fast = $quick;
            $result = $this->vision->analyze($candidates, $bytes, $mimeType, $promptText, $quick ? null : $parallel);
        } catch (\Throwable $e) {
            return new JsonResponse(['success' => false, 'error' => 'Yapay zeka yanıt veremedi: ' . $e->getMessage()]);
        }
        $side = is_array($result['side'] ?? null) ? $result['side'] : [];

        $data = $this->dropGuessedLocation($result['data']);
        $notes = [];
        $similar = null;
        $sceneVec = $side['similar']['vec'] ?? null;
        $nearest = $side['similar']['nearest'] ?? [];
        // Son yüklemeler, dizindekilerle aynı biçimde aday listesine katılır
        foreach ($recent as $i => $r) {
            if ($sceneVec && !empty($side['recent' . $i])) {
                $nearest[] = $r + ['score' => array_sum(array_map(fn ($a, $b) => $a * $b, $sceneVec, $side['recent' . $i]))];
            }
        }
        usort($nearest, fn ($a, $b) => $b['score'] <=> $a['score']);
        // Model doğrulaması (güçlü model, yüksek/orta güven) hızlı yanıtın marka/modelinin önüne geçer
        $verified = $side['vehicle'] ?? [];
        if (!empty($verified['model']) && in_array(strtolower((string) ($verified['confidence'] ?? '')), ['high', 'medium'], true)) {
            if (!empty($verified['brand'])) $data['brand'] = $verified['brand'];
            $data['model'] = $verified['model'];
            $data['model_source'] = 'verified';
        }
        // Forumdaki %95+ benzer gönderiler (elle girilmiş künyeler): marka/model için çoğunluk; yapay zekanın önüne geçer.
        // Firma, plaka ve konum bu yoldan ALINMAZ.
        $votes = [];
        foreach ((array) ($side['vehicle_sim'] ?? []) as $n) {
            if (($n['score'] ?? 0) < 0.95) continue;
            $k = $this->history->kunyeOf($n);
            if (empty($k['model'])) continue;
            $brand = (string) ($k['brand'] ?? '');
            $model = $brand !== '' && stripos($k['model'], $brand . ' ') === 0 ? trim(mb_substr($k['model'], mb_strlen($brand))) : $k['model'];
            $key = mb_strtolower($brand . '|' . $model);
            $votes[$key] ??= ['brand' => $brand, 'model' => $model, 'n' => 0, 'best' => 0];
            $votes[$key]['n']++;
            $votes[$key]['best'] = max($votes[$key]['best'], $n['score']);
        }
        if ($votes) {
            usort($votes, fn ($a, $b) => [$b['n'], $b['best']] <=> [$a['n'], $a['best']]);
            $v = $votes[0];
            if ($v['brand'] !== '') $data['brand'] = $v['brand'];
            $data['model'] = $v['model'];
            $data['model_source'] = 'similar';
            $data['model_similarity'] = round($v['best'] * 100);
        }
        $seenModel = (string) ($data['model'] ?? '');
        if ($useHistory) {
            // Plaka forumda birebir kayıtlıysa (ve firma çelişmiyorsa) araç bilgisi o künyelerden
            ['data' => $data, 'notes' => $notes] = $this->history->enrich($data);
            // Forum geçmişi fotoğrafta doğrulanan modelle çelişiyorsa fotoğraf esas alınır, çelişki bildirilir (asistan sorar)
            $norm = fn ($s) => preg_replace('/[^a-z0-9]/', '', strtolower((string) $s));
            if (in_array($data['model_source'] ?? '', ['verified', 'similar'], true) && $seenModel !== '' && $norm($data['model'] ?? '') !== $norm($seenModel)) {
                $data['model_history'] = $data['model'];
                $data['model'] = $seenModel;
                if (!empty($verified['brand'])) $data['brand'] = $verified['brand'];
                $notes[] = 'model_conflict';
            }
        }

        // ── Çekim yeri: 1) fotoğrafın GPS bilgisi  2) yapay zekanın kendi tespiti (yüksek/orta güven)
        //               3) bulunamazsa forumda %95+ benzeyen fotoğrafın çekim yeri
        $loc = null;
        $locSource = null;
        if (!empty($side['gps'])) {
            $loc = $side['gps'];
            $locSource = 'gps';
        }
        if (!$loc) {
            foreach ([$side['geo'] ?? [], $data] as $guess) {
                $conf = strtolower((string) ($guess['location_confidence'] ?? ''));
                if (!empty($guess['city']) && in_array($conf, ['high', 'medium'], true)) {
                    $loc = ['city' => $guess['city'], 'place' => (string) ($guess['place'] ?? '')];
                    $locSource = $conf === 'high' ? 'ai' : 'ai_guess';
                    break;
                }
            }
        }
        if (!$loc && $nearest) {
            // En az %95: daha düşük bir eşik kaydedilmiş olsa bile uygulanmaz
            $placeThreshold = max(0.95, (float) ($this->settings->get('framio-upload-exif.ai_location_threshold') ?: 0.95));
            foreach ($nearest as $n) {
                if ($n['score'] < $placeThreshold) break;
                if ($s = $this->location->entitiesLocation([$n['post_id']], $n['image_url'])) {
                    $loc = $s;
                    $locSource = 'similar';
                    $similar = $this->history->describe($n);
                    break;
                }
            }
        }
        unset($data['city'], $data['place'], $data['location_confidence'], $data['location'], $data['location_guess']);

        // Künyedeki yıl ÇEKİM yılıdır ('26): fotoğrafın EXIF tarihinden alınır. Yapay zekanın tahmin
        // ettiği model yılı (ör. 2012) bu alana yazılmaz; EXIF yoksa yıl boş kalır (tarayıcı dosya tarihini kullanır).
        unset($data['year'], $data['year_guess']);
        if ($exif['date']) {
            $data['year'] = $exif['date']->format('Y');
            $data['year_source'] = 'exif';
        }

        // Plaka dosya adında yazılıysa o esas alınır (yapay zeka benzer harfleri karıştırabiliyor: ADH ↔ AOH)
        $fileName = (string) Arr::get($body, 'file_name', '');
        if ($fileName === '' && $file) $fileName = (string) $file->getClientFilename();
        if (($fromName = $this->plateFromName($fileName)) !== null) {
            $data['plate'] = $fromName;
            $data['plate_source'] = 'filename';
        }
        if ($loc) {
            $data['location'] = $this->location->format($loc['city'], $loc['place'] ?? '', $detailed);
            $data['city'] = $loc['city'];
        }

        if (!$data && !empty($result['error'])) {
            return new JsonResponse(['success' => false, 'error' => 'Yapay zeka yanıt veremedi: ' . $result['error']]);
        }

        return new JsonResponse([
            'success' => true,
            'history' => $notes,
            'similar' => $similar,
            'location_source' => $locSource,
            'provider' => $result['provider'],
            'model' => $result['model'],
            'source' => $result['source'],
            'cached' => $result['cached'],
            'ms' => $result['ms'],
            'data' => $data,
        ]);
    }

    protected function locationRule(bool $detailed, array $knownPlaces): string
    {
        $rule = "- Çekim yeri: JSON'a \"city\" (il adı, ör. Ankara), \"place\" (" . ($detailed ? 'şehir içindeki semt, durak, garaj, meydan ya da cadde' : 'otogar, tesis ya da ilçe; yoksa boş') . ") ve \"location_confidence\" (high | medium | low) ekle.\n"
            . "  Tabelalara, otogar/peron mimarisine, bilinen binalara, siluete ve çevreye bakarak tahmin et. Plakanın il kodundan ya da firma adındaki şehirden ÇIKARIM YAPMA.\n"
            . "  high: tabela/isim okunuyor ya da yer çok tanınmış; medium: mimari ve çevre güçlü biçimde işaret ediyor; low: tahmin.\n";
        if ($knownPlaces) {
            $rule .= "  Forumda daha önce geçen çekim yerleri (uyuyorsa bu yazımı kullan): " . implode(', ', $knownPlaces) . "\n";
        }

        return $rule;
    }

    /** Konum sorusu için yer tanımada güçlü bir Gemini sağlayıcısı (varsa) */
    /** Sık karıştırılan modelleri ayırt etme ipuçları (ana istem ve model doğrulama sorusunda) */
    public const MODEL_CUES = "- Sık karıştırılanlar: Mercedes-Benz Tourismo (2017 sonrası, ör. Tourismo 16 RHD): köşeli, ince uzun farlar; siyah, geniş ön panelde büyük yıldız; düz tavan çizgisi; ön camın üstü düz. "
        . "Mercedes-Benz Travego (ör. Travego 15 SHD): yuvarlak hatlı, oval/damla farlar; krom çerçeveli ızgara; SHD'de arka bölüm belirgin yüksek (yükseltilmiş tavan); yan camların alt çizgisi arkaya doğru yükselir. "
        . "Emin değilsen modeli boş bırak.\n";

    protected function geoCandidate(array $candidates): ?array
    {
        foreach ($candidates as $c) {
            if ($c['provider'] === 'gemini') {
                $model = trim((string) $this->settings->get('framio-upload-exif.ai_location_model'));

                return ['model' => $model !== '' ? $model : 'gemini-3.8-flash'] + $c;
            }
        }

        return null;
    }

    /** "02 ADH 788.webp", "02ADH788-1.jpg" → "02 ADH 788" */
    protected function plateFromName(string $name): ?string
    {
        $base = mb_strtoupper(preg_replace('/\.[a-z0-9]+$/i', '', $name), 'UTF-8');
        if (preg_match('/(?<!\d)(0[1-9]|[1-7]\d|8[01])[\s_.-]*([A-ZÇĞİÖŞÜ]{1,3})[\s_.-]*(\d{2,5})(?!\d)/u', $base, $m)) {
            return $m[1] . ' ' . $m[2] . ' ' . $m[3];
        }

        return null;
    }

    protected const PLATE_CITIES = [1 => 'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin', 'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce'];

    /** Çekim yeri yalnızca plakanın ili ya da firma adındaki şehirse tahmindir: at */
    protected function dropGuessedLocation(array $data): array
    {
        $low = fn ($s) => mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], trim((string) $s)), 'UTF-8');
        if (strtolower((string) ($data['location_confidence'] ?? '')) === 'high') return $data;
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
