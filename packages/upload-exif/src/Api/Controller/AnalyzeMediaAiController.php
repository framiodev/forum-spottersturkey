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

class AnalyzeMediaAiController implements RequestHandlerInterface
{
    protected $settings;

    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $body = $request->getParsedBody();
        $uploadedFiles = $request->getUploadedFiles();
        $file = $uploadedFiles['image'] ?? null;
        $imageUrl = Arr::get($body, 'image_url');

        // Check if AI is enabled globally
        $aiEnabled = $this->settings->get('framio-upload-exif.ai_enabled', '1');
        if ($aiEnabled === '0') {
            return new JsonResponse(['error' => 'Vision AI servisi forum yöneticisi tarafından devre dışı bırakılmış.'], 400);
        }

        // 1. Kullanıcı Tercihleri ve Öncelik Sıralaması
        $allowUserKeys = $this->settings->get('framio-upload-exif.allow_user_ai_keys', '1') !== '0';
        
        $userApiKey = Arr::get($body, 'custom_api_key');
        $userProvider = Arr::get($body, 'custom_provider');
        $userModel = Arr::get($body, 'custom_model');

        if ($allowUserKeys && $actor) {
            if (empty($userApiKey)) {
                $userApiKey = $actor->getPreference('framio_personal_ai_key');
            }
            if (empty($userProvider) || $userProvider === 'default') {
                $userProvider = $actor->getPreference('framio_personal_ai_provider');
            }
            if (empty($userModel)) {
                $userModel = $actor->getPreference('framio_personal_ai_model');
            }
        }

        // Fallback to System Settings
        $provider = (!empty($userProvider) && $userProvider !== 'default') 
            ? $userProvider 
            : ($this->settings->get('framio-upload-exif.ai_provider', 'gemini') ?: 'gemini');

        $apiKey = !empty($userApiKey) 
            ? trim($userApiKey) 
            : trim($this->settings->get('framio-upload-exif.ai_api_key', '') ?: '');

        $model = !empty($userModel) 
            ? trim($userModel) 
            : trim($this->settings->get('framio-upload-exif.ai_model', '') ?: '');

        // Default model fallback per provider
        if (empty($model)) {
            switch ($provider) {
                case 'openai': $model = 'gpt-4o-mini'; break;
                case 'grok': $model = 'grok-2-vision-1212'; break;
                case 'claude': $model = 'claude-sonnet-4.6'; break;
                case 'gemini':
                default: $model = 'gemini-3.7-flash'; break;
            }
        }

        if (empty($apiKey)) {
            return new JsonResponse([
                'error' => 'Vision AI yapılandırılmamış. Lütfen Admin panelinden veya Profil ayarlarınızdan bir API Anahtarı giriniz.'
            ], 400);
        }

        // Image data retrieval
        $base64Image = null;
        $mimeType = 'image/jpeg';

        if ($file && $file->getError() === UPLOAD_ERR_OK) {
            $stream = $file->getStream();
            $base64Image = base64_encode($stream->getContents());
            $clientFilename = $file->getClientFilename();
            $ext = strtolower(pathinfo($clientFilename, PATHINFO_EXTENSION));
            if ($ext === 'webp') $mimeType = 'image/webp';
            elseif ($ext === 'png') $mimeType = 'image/png';
        } elseif ($imageUrl) {
            try {
                $client = new Client(['timeout' => 8.0]);
                $resp = $client->get($imageUrl);
                $base64Image = base64_encode($resp->getBody()->getContents());
            } catch (\Throwable $e) {
                return new JsonResponse(['error' => 'Görsel URL adresinden çekilemedi.'], 400);
            }
        }

        if (!$base64Image) {
            return new JsonResponse(['error' => 'Analiz edilecek görsel verisi bulunamadı.'], 400);
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
            $client = new Client(['timeout' => 25.0]);
            $candidateText = '';

            if ($provider === 'openai') {
                $response = $client->post('https://api.openai.com/v1/chat/completions', [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $apiKey,
                        'Content-Type' => 'application/json'
                    ],
                    'json' => [
                        'model' => $model,
                        'messages' => [
                            [
                                'role' => 'user',
                                'content' => [
                                    ['type' => 'text', 'text' => $promptText],
                                    [
                                        'type' => 'image_url',
                                        'image_url' => [
                                            'url' => "data:{$mimeType};base64,{$base64Image}"
                                        ]
                                    ]
                                ]
                            ]
                        ],
                        'response_format' => ['type' => 'json_object'],
                        'temperature' => 0.1,
                        'max_tokens' => 600
                    ]
                ]);
                $resData = json_decode($response->getBody()->getContents(), true);
                $candidateText = $resData['choices'][0]['message']['content'] ?? '{}';

            } elseif ($provider === 'grok') {
                $response = $client->post('https://api.x.ai/v1/chat/completions', [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $apiKey,
                        'Content-Type' => 'application/json'
                    ],
                    'json' => [
                        'model' => $model,
                        'messages' => [
                            [
                                'role' => 'user',
                                'content' => [
                                    ['type' => 'text', 'text' => $promptText],
                                    [
                                        'type' => 'image_url',
                                        'image_url' => [
                                            'url' => "data:{$mimeType};base64,{$base64Image}"
                                        ]
                                    ]
                                ]
                            ]
                        ],
                        'temperature' => 0.1,
                        'max_tokens' => 600
                    ]
                ]);
                $resData = json_decode($response->getBody()->getContents(), true);
                $candidateText = $resData['choices'][0]['message']['content'] ?? '{}';

            } elseif ($provider === 'claude') {
                $response = $client->post('https://api.anthropic.com/v1/messages', [
                    'headers' => [
                        'x-api-key' => $apiKey,
                        'anthropic-version' => '2023-06-01',
                        'Content-Type' => 'application/json'
                    ],
                    'json' => [
                        'model' => $model,
                        'max_tokens' => 600,
                        'messages' => [
                            [
                                'role' => 'user',
                                'content' => [
                                    [
                                        'type' => 'image',
                                        'source' => [
                                            'type' => 'base64',
                                            'media_type' => $mimeType,
                                            'data' => $base64Image
                                        ]
                                    ],
                                    [
                                        'type' => 'text',
                                        'text' => $promptText
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]);
                $resData = json_decode($response->getBody()->getContents(), true);
                $candidateText = $resData['content'][0]['text'] ?? '{}';

            } else {
                // Google Gemini (Default)
                $apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
                $response = $client->post($apiUrl, [
                    'headers' => ['Content-Type' => 'application/json'],
                    'json' => [
                        'contents' => [
                            [
                                'parts' => [
                                    ['text' => $promptText],
                                    [
                                        'inline_data' => [
                                            'mime_type' => $mimeType,
                                            'data' => $base64Image
                                        ]
                                    ]
                                ]
                            ]
                        ],
                        'generationConfig' => [
                            'temperature' => 0.1,
                            'response_mime_type' => 'application/json'
                        ]
                    ]
                ]);
                $resData = json_decode($response->getBody()->getContents(), true);
                $candidateText = $resData['candidates'][0]['content']['parts'][0]['text'] ?? '{}';
            }

            // Clean Markdown code blocks if any
            $candidateText = preg_replace('/^```(?:json)?\s*/i', '', trim($candidateText));
            $candidateText = preg_replace('/```$/', '', trim($candidateText));

            $parsed = json_decode($candidateText, true);

            return new JsonResponse([
                'success' => true,
                'provider' => $provider,
                'model' => $model,
                'data' => is_array($parsed) ? $parsed : []
            ]);

        } catch (\GuzzleHttp\Exception\ClientException $e) {
            $respBody = $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : '';
            $decoded = json_decode($respBody, true);
            $msg = $decoded['error']['message'] ?? $decoded['message'] ?? $e->getMessage();
            return new JsonResponse([
                'error' => "{$provider} API Hatası: " . $msg
            ], 400);
        } catch (\Throwable $e) {
            return new JsonResponse([
                'error' => 'AI analizi sırasında hata oluştu: ' . $e->getMessage()
            ], 500);
        }
    }
}
