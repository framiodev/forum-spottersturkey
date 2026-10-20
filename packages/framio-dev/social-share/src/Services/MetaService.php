<?php

namespace Framio\SocialShare\Services;

use GuzzleHttp\Client;
use Carbon\Carbon;
use Illuminate\Database\ConnectionInterface;
use Psr\Log\LoggerInterface;

class MetaService
{
    protected $client;
    protected $db;
    protected $logger;
protected $baseUrl = 'https://graph.facebook.com/v19.0';
    protected $threadsBaseUrl = 'https://graph.threads.net/v1.0';

    public function __construct(ConnectionInterface $db, LoggerInterface $logger)
    {
        $this->client = new Client();
        $this->db = $db;
        $this->logger = $logger;
    }

    public function publish($messageFb, $messageIg, $images, $pageId, $igId, $userToken, $scheduleTime = null, $userId = 1, $isCronJob = false, $messageThreads = '', $threadsId = null)
    {
        // Görsel öğesi düz adres ya da ['url' => …, 'caption' => …] olabilir.
        // Fotoğraf başına açıklama yalnızca Facebook'ta desteklenir (Instagram
        // ve Threads kaydırmalı gönderide tek açıklama kabul eder).
        $fbImages = $images;
        $images = array_values(array_filter(array_map(fn ($i) => is_array($i) ? ($i['url'] ?? null) : $i, $images)));

        // Tam kalite: görseller seçilirken Firebase'e hazırlanır (imzasız orijinal + o fotoğrafın imzası).
        // Hazırlanmamış olan varsa (eski plan) burada hazırlanır.
        $preparer = resolve(SocialImagePreparer::class);
        try {
            $map = $preparer->prepareMap($images);
            $images = array_map(fn ($u) => $map[$u] ?? $u, $images);
            $fbImages = array_map(fn ($i) => is_array($i) ? (['url' => $map[$i['url'] ?? ''] ?? ($i['url'] ?? null)] + $i) : ($map[$i] ?? $i), $fbImages);
        } catch (\Throwable $e) {
            $this->log('Görsel hazırlama atlandı: ' . $e->getMessage());
        }

        if ($scheduleTime && !$isCronJob) {
            // Planlandı: hazırlanmış görseller paylaşım saatine kadar korunur
            $preparer->markQueued($images);

            return $this->saveToQueue($userId, $messageFb, $messageIg, $images, $pageId, $igId, $userToken, $scheduleTime, $messageThreads, $threadsId, $fbImages);
        }

        $this->log("--- ANLIK PAYLAŞIM BAŞLADI ---");
        
        $errors = [];
        $successData = [];

        $pageToken = $this->getPageAccessToken($pageId, $userToken);
        $finalToken = $pageToken ?: $userToken;

        // --- FACEBOOK ---
        if ($pageId && !empty($messageFb)) {
            try {
                $fbResult = $this->postToFacebook($pageId, $messageFb, $fbImages, $finalToken);
                $successData['facebook'] = $fbResult;
                $this->log("FB Başarılı ID: " . ($fbResult['id'] ?? 'Yok'));
            } catch (\Exception $e) {
                $this->log("FB Hatası: " . $e->getMessage());
            }
        }

        // --- INSTAGRAM ---
        if ($igId && !empty($messageIg)) {
            try {
                $igResult = $this->postToInstagram($igId, $messageIg, $images, $finalToken);
                $successData['instagram'] = $igResult;
                $this->log("IG Başarılı ID: " . ($igResult['id'] ?? 'Yok'));
            } catch (\Exception $e) {
                $err = "IG Hatası: " . $e->getMessage();
                $errors[] = $err;
                $this->log($err);
            }
        }

        // --- THREADS ---
        if ($threadsId && !empty($messageThreads)) {
            try {
                $threadsResult = $this->postToThreads($threadsId, $messageThreads, $images, $userToken);
                $successData['threads'] = $threadsResult;
                $this->log("Threads Başarılı ID: " . ($threadsResult['id'] ?? 'Yok'));
            } catch (\Exception $e) {
                $err = "Threads Hatası: " . $e->getMessage();
                $errors[] = $err;
                $this->log($err);
            }
        }

        // Paylaşıldı: hazırlanmış tam boy görseller 15 dakika sonra Firebase'den silinir
        if (!empty($successData)) $preparer->markPublished($images);

        if (empty($successData) && !empty($errors)) {
            throw new \Exception(implode(', ', $errors));
        }

        return $successData;
    }

    protected function saveToQueue($userId, $messageFb, $messageIg, $images, $pageId, $igId, $userToken, $scheduleTime, $messageThreads = '', $threadsId = null, $fbImages = null)
    {
        try {
            $date = new \DateTime($scheduleTime, new \DateTimeZone('Europe/Istanbul'));
            $formattedTime = $date->format('Y-m-d H:i:s');

            $this->log("DEBUG - saveToQueue: pageId='$pageId', igId='$igId', threadsId='$threadsId'");

            $messages = [];

            if ($pageId && !empty($messageFb)) {
                $payloadFb = json_encode([
                    'platform' => 'facebook',
                    'message' => $messageFb,
                    'images' => $fbImages ?? $images, // fotoğraf açıklamaları korunur
                    'pageId' => $pageId,
                    'userToken' => $userToken
                ]);
                $this->db->table('framio_social_queue')->insert([
                    'user_id' => $userId,
                    'payload' => $payloadFb,
                    'status' => 'pending',
                    'scheduled_at' => $formattedTime
                ]);
                $messages[] = 'Facebook kuyruğa alındı.';
            }

            if ($igId && !empty($messageIg)) {
                $payloadIg = json_encode([
                    'platform' => 'instagram',
                    'message' => $messageIg,
                    'images' => $images,
                    'igId' => $igId,
                    'userToken' => $userToken
                ]);
                $this->db->table('framio_social_queue')->insert([
                    'user_id' => $userId,
                    'payload' => $payloadIg,
                    'status' => 'pending',
                    'scheduled_at' => $formattedTime
                ]);
                $messages[] = 'Instagram kuyruğa alındı.';
            }

            if ($threadsId && !empty($messageThreads)) {
                $payloadThreads = json_encode([
                    'platform' => 'threads',
                    'message' => $messageThreads,
                    'images' => $images,
                    'threadsId' => $threadsId,
                    'userToken' => $userToken
                ]);
                $this->db->table('framio_social_queue')->insert([
                    'user_id' => $userId,
                    'payload' => $payloadThreads,
                    'status' => 'pending',
                    'scheduled_at' => $formattedTime
                ]);
                $messages[] = 'Threads kuyruğa alındı.';
            }

            $this->log("Gönderiler yerel veritabanına zamanlandı: $formattedTime");
            
            return ['status' => 'queued', 'scheduled_at' => $formattedTime, 'message' => implode(' ', $messages)];

        } catch (\Exception $e) {
            $this->log("Veritabanı Kayıt Hatası: " . $e->getMessage());
            throw new \Exception("Zamanlama veritabanına kaydedilemedi: " . $e->getMessage());
        }
    }

public function queueStory($userId, $targetId, $imageUrl, $token, $scheduleTime, $platform = 'instagram_story')
    {
        try {
            $date = new \DateTime($scheduleTime, new \DateTimeZone('Europe/Istanbul'));
            $formattedTime = $date->format('Y-m-d H:i:s');
            $groupId = 'grp_story_' . time() . '_' . bin2hex(random_bytes(4));
            $isFb = ($platform === 'facebook_story');

            $payload = json_encode([
                'group_id' => $groupId,
                'platform' => $isFb ? 'facebook_story' : 'instagram_story',
                'type' => 'story',
                'message' => $isFb ? 'Facebook Hikayesi (Story)' : 'Instagram Hikayesi (Story)',
                'images' => [$imageUrl],
                'igId' => $isFb ? null : $targetId,
                'pageId' => $isFb ? $targetId : null,
                'userToken' => $token,
                'image_url' => $imageUrl
            ]);

            $this->db->table('framio_social_queue')->insert([
                'user_id' => $userId,
                'payload' => $payload,
                'status' => 'pending',
                'scheduled_at' => $formattedTime
            ]);

            $this->log("Hikaye yerel kuyruga zamanlandi: $formattedTime ($platform)");
            return ['status' => 'queued', 'scheduled_at' => $formattedTime, 'message' => 'Hikaye basariyla zamanlandi.'];
        } catch (\Exception $e) {
            $this->log("Hikaye Zamanlama Hatasi: " . $e->getMessage());
            throw new \Exception("Hikaye zamanlanamadi: " . $e->getMessage());
        }
    }

    protected function log($msg) {
        $this->logger->info("[Framio Social Share] " . $msg);
    }

    protected function getPageAccessToken($pageId, $userToken)
    {
        try {
            $response = $this->client->get("{$this->baseUrl}/{$pageId}", [
                'query' => [
                    'fields' => 'access_token',
                    'access_token' => $userToken
                ]
            ]);
            $data = json_decode($response->getBody(), true);
            return $data['access_token'] ?? null;
        } catch (\Exception $e) { return null; }
    }

    protected function postToFacebook($pageId, $message, $images, $token)
    {
        // Öğe: düz adres ya da ['url' => …, 'caption' => …] (fotoğrafa özel açıklama)
        $items = array_values(array_filter(
            array_map(fn ($i) => is_array($i) ? $i : ['url' => $i], $images),
            fn ($i) => !empty($i['url'])
        ));

        if (count($items) === 1) {
            $params = ['url' => $items[0]['url'], 'message' => $message, 'access_token' => $token, 'published' => true];
            $response = $this->client->post("{$this->baseUrl}/{$pageId}/photos", ['form_params' => $params]);
            return json_decode($response->getBody(), true);
        }
        $mediaIds = [];
        foreach ($items as $item) {
            $params = ['url' => $item['url'], 'published' => false, 'access_token' => $token];
            // Çok fotoğraflı gönderide fotoğraf açıldığında kendi açıklaması görünür
            if (!empty($item['caption'])) {
                $params['caption'] = $item['caption'];
            }
            $res = $this->client->post("{$this->baseUrl}/{$pageId}/photos", ['form_params' => $params]);
            $data = json_decode($res->getBody(), true);
            if (isset($data['id'])) $mediaIds[] = ['media_fbid' => $data['id']];
        }
        $feedParams = ['message' => $message, 'attached_media' => $mediaIds, 'access_token' => $token, 'published' => true];
        $response = $this->client->post("{$this->baseUrl}/{$pageId}/feed", ['json' => $feedParams]);
        return json_decode($response->getBody(), true);
    }

    protected function postToInstagram($igId, $message, $images, $token)
    {
        $creationId = null;
        if (count($images) === 1) {
            $containerParams = ['image_url' => $images[0], 'caption' => $message, 'access_token' => $token];
            $res = $this->client->post("{$this->baseUrl}/{$igId}/media", ['form_params' => $containerParams]);
            $containerData = json_decode($res->getBody(), true);
            if (!isset($containerData['id'])) throw new \Exception("IG Container Hatası.");
            $creationId = $containerData['id'];
        } else {
            $childIds = [];
            foreach ($images as $imgUrl) {
                $itemParams = ['image_url' => $imgUrl, 'is_carousel_item' => true, 'access_token' => $token];
                $res = $this->client->post("{$this->baseUrl}/{$igId}/media", ['form_params' => $itemParams]);
                $data = json_decode($res->getBody(), true);
                if (isset($data['id'])) $childIds[] = $data['id'];
            }
            $carouselParams = ['media_type' => 'CAROUSEL', 'children' => implode(',', $childIds), 'caption' => $message, 'access_token' => $token];
            $res = $this->client->post("{$this->baseUrl}/{$igId}/media", ['form_params' => $carouselParams]);
            $data = json_decode($res->getBody(), true);
            $creationId = $data['id'] ?? null;
        }

        if (!$creationId) {
            throw new \Exception("Instagram Media ID oluşturulamadı.");
        }

        $maxRetries = 6;
        $attempt = 0;
        $lastError = "";

        while ($attempt < $maxRetries) {
            $attempt++;
            sleep(5);

            try {
                $publishParams = ['creation_id' => $creationId, 'access_token' => $token];
                $res = $this->client->post("{$this->baseUrl}/{$igId}/media_publish", ['form_params' => $publishParams]);
                return json_decode($res->getBody(), true);
            } catch (\Exception $e) {
                $lastError = $e->getMessage();
            }
        }

        throw new \Exception("Instagram Yayınlama Hatası (İşlem Zaman Aşımı): " . $lastError);
    }
    
    // --- THREADS GÖNDERİ PAYLAŞIMI ---
    protected function postToThreads($threadsUserId, $message, $images, $token)
    {
        $creationId = null;

        $endpoints = [
            "https://graph.threads.net/v1.0/{$threadsUserId}",
            "https://graph.facebook.com/v19.0/{$threadsUserId}"
        ];

        $lastCreationError = "Bilinmeyen hata";

        if (empty($images)) {
            $params = [
                'media_type' => 'TEXT',
                'text' => $message,
                'access_token' => $token
            ];
            
            foreach ($endpoints as $ep) {
                try {
                    $res = $this->client->post("{$ep}/threads", ['form_params' => $params]);
                    $data = json_decode($res->getBody(), true);
                    if (isset($data['id'])) {
                        $creationId = $data['id'];
                        break;
                    }
                } catch (\Exception $e) {
                    $lastCreationError = $e->getMessage();
                }
            }
        } else if (count($images) === 1) {
            $params = [
                'media_type' => 'IMAGE',
                'image_url' => $images[0],
                'text' => $message,
                'access_token' => $token
            ];
            
            foreach ($endpoints as $ep) {
                try {
                    $res = $this->client->post("{$ep}/threads", ['form_params' => $params]);
                    $data = json_decode($res->getBody(), true);
                    if (isset($data['id'])) {
                        $creationId = $data['id'];
                        break;
                    }
                } catch (\Exception $e) {
                    $lastCreationError = $e->getMessage();
                }
            }
        } else {
            $childIds = [];
            foreach ($images as $imgUrl) {
                $cParams = [
                    'media_type' => 'IMAGE',
                    'image_url' => $imgUrl,
                    'is_carousel_item' => true,
                    'access_token' => $token
                ];
                
                $childCreated = false;
                foreach ($endpoints as $ep) {
                    try {
                        $res = $this->client->post("{$ep}/threads", ['form_params' => $cParams]);
                        $data = json_decode($res->getBody(), true);
                        if (isset($data['id'])) {
                            $childIds[] = $data['id'];
                            $childCreated = true;
                            break;
                        }
                    } catch (\Exception $e) {
                        $lastCreationError = $e->getMessage();
                    }
                }
            }

            if (count($childIds) > 0) {
                $carouselParams = [
                    'media_type' => 'CAROUSEL',
                    'children' => implode(',', $childIds),
                    'text' => $message,
                    'access_token' => $token
                ];
                
                foreach ($endpoints as $ep) {
                    try {
                        $res = $this->client->post("{$ep}/threads", ['form_params' => $carouselParams]);
                        $data = json_decode($res->getBody(), true);
                        if (isset($data['id'])) {
                            $creationId = $data['id'];
                            break;
                        }
                    } catch (\Exception $e) {
                        $lastCreationError = $e->getMessage();
                    }
                }
            }
        }

        if (!$creationId) {
            throw new \Exception("Threads Container ID oluşturulamadı: " . $lastCreationError);
        }

        $publishEndpoints = [
            "https://graph.threads.net/v1.0/{$threadsUserId}/threads_publish",
            "https://graph.facebook.com/v19.0/{$threadsUserId}/threads_publish"
        ];

        $maxRetries = 6;
        $attempt = 0;
        $lastError = "";

        while ($attempt < $maxRetries) {
            $attempt++;
            sleep(5);

            foreach ($publishEndpoints as $pubEp) {
                try {
                    $publishParams = ['creation_id' => $creationId, 'access_token' => $token];
                    $res = $this->client->post($pubEp, ['form_params' => $publishParams]);
                    return json_decode($res->getBody(), true);
                } catch (\Exception $e) {
                    $lastError = $e->getMessage();
                }
            }
        }

        throw new \Exception("Threads Yayınlama Hatası (İşlem Zaman Aşımı): " . $lastError);
    }

    // 1. Instagram Silme
    public function deleteInstagramMedia($mediaId, $token)
    {
        try {
            $response = $this->client->delete("{$this->baseUrl}/{$mediaId}", [
                'query' => ['access_token' => $token]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Instagram Silme Hatası: " . $e->getMessage());
            throw new \Exception("Instagram silinemedi: " . $e->getMessage());
        }
    }

    // 2. Facebook Silme
    public function deleteFacebookPost($postId, $token)
    {
        try {
            $response = $this->client->delete("{$this->baseUrl}/{$postId}", [
                'query' => ['access_token' => $token]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Facebook Silme Hatası: " . $e->getMessage());
            throw new \Exception("Facebook silinemedi: " . $e->getMessage());
        }
    }

    // 3. Threads Silme
    public function deleteThreadsPost($threadsPostId, $token)
    {
        try {
            $response = $this->client->delete("{$this->threadsBaseUrl}/{$threadsPostId}", [
                'query' => ['access_token' => $token]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Threads Silme Hatası: " . $e->getMessage());
            throw new \Exception("Threads silinemedi: " . $e->getMessage());
        }
    }

    // ==========================================
    // --- META BUSINESS SUITE API ENTEGRASYONU ---
    // ==========================================

    // 1. Instagram Hesap Profili ve Temel İstatistikleri
    public function getInstagramProfile($igId, $token)
    {
        try {
            $fields = 'id,username,name,profile_picture_url,biography,followers_count,follows_count,media_count,website';
            $response = $this->client->get("{$this->baseUrl}/{$igId}", [
                'query' => [
                    'fields' => $fields,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("IG Profil Çekme Hatası: " . $e->getMessage());
            return null;
        }
    }

    // 2. Instagram Gelişmiş Insights (Erişim, Görüntüleme, Profil Ziyaretleri, Etkileşimler)
    public function getInstagramInsights($igId, $token, $period = 'day')
    {
        try {
            // Meta Graph API v19+ güncel metrikleri
            $metrics = 'reach,views,profile_views,total_interactions,accounts_engaged';
            $response = $this->client->get("{$this->baseUrl}/{$igId}/insights", [
                'query' => [
                    'metric' => $metrics,
                    'metric_type' => 'total_value',
                    'period' => $period,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("IG Insights Çekme Hatası: " . $e->getMessage());
            return ['error' => $e->getMessage(), 'data' => []];
        }
    }

    // 3. Son Paylaşılan Gönderiler (Feed, Reels & Stories)
    public function getInstagramMediaList($igId, $token, $limit = 15)
    {
        try {
            $fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count';
            $response = $this->client->get("{$this->baseUrl}/{$igId}/media", [
                'query' => [
                    'fields' => $fields,
                    'limit' => $limit,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("IG Media Listesi Çekme Hatası: " . $e->getMessage());
            return ['data' => []];
        }
    }

    // 4. Gönderi Yorumlarını Çekme
    public function getMediaComments($mediaId, $token)
    {
        try {
            $fields = 'id,text,timestamp,username,like_count,replies{id,text,timestamp,username}';
            $response = $this->client->get("{$this->baseUrl}/{$mediaId}/comments", [
                'query' => [
                    'fields' => $fields,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Yorum Çekme Hatası: " . $e->getMessage());
            return ['data' => []];
        }
    }

    // 5. Yoruma Yanıt Verme
    public function replyToComment($commentId, $message, $token)
    {
        try {
            $response = $this->client->post("{$this->baseUrl}/{$commentId}/replies", [
                'form_params' => [
                    'message' => $message,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Yorum Yanıtlama Hatası: " . $e->getMessage());
            throw new \Exception("Yoruma yanıt verislemedi: " . $e->getMessage());
        }
    }

    // 6. Yorum Silme / Gizleme
    public function deleteOrHideComment($commentId, $token, $hide = false)
    {
        try {
            if ($hide) {
                $response = $this->client->post("{$this->baseUrl}/{$commentId}", [
                    'form_params' => [
                        'hide' => true,
                        'access_token' => $token
                    ]
                ]);
            } else {
                $response = $this->client->delete("{$this->baseUrl}/{$commentId}", [
                    'query' => ['access_token' => $token]
                ]);
            }
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Yorum Silme/Gizleme Hatası: " . $e->getMessage());
            throw new \Exception("Yorum işlemi başarısız: " . $e->getMessage());
        }
    }

    public function resolvePublicImageUrl($imageUrl)
    {
        if (!$imageUrl) return $imageUrl;

        $isLocal = preg_match('/(\.test|localhost|127\.0\.0\.1)/i', $imageUrl) || !preg_match('/^https?:\/\//i', $imageUrl);
        if (!$isLocal) {
            return $imageUrl;
        }

        $pathOnly = parse_url($imageUrl, PHP_URL_PATH) ?: $imageUrl;
        $filename = basename($pathOnly);

        $possiblePaths = [
            public_path('assets/stories/' . $filename),
            public_path('assets/social-temp/' . $filename),
            public_path('assets/temp_processing/' . $filename),
            public_path('assets/' . $filename),
            public_path(ltrim($pathOnly, '/\\'))
        ];

        $foundLocalPath = null;
        foreach ($possiblePaths as $p) {
            if (file_exists($p)) {
                $foundLocalPath = $p;
                break;
            }
        }

        $firebaseKey = base_path('firebase-key.json');
        if ($foundLocalPath && file_exists($firebaseKey) && class_exists('\Google\Cloud\Storage\StorageClient')) {
            try {
                $storage = new \Google\Cloud\Storage\StorageClient(['keyFilePath' => $firebaseKey]);
                $bucket = $storage->bucket('ulasim-arsiv-forum-storage.firebasestorage.app');
                $cloudPath = 'assets/stories/' . $filename;
                
                $bucket->upload(fopen($foundLocalPath, 'r'), [
                    'name' => $cloudPath,
                    'predefinedAcl' => 'publicRead',
                    'metadata' => [
                        'contentType' => mime_content_type($foundLocalPath) ?: 'image/jpeg',
                        'contentDisposition' => 'inline; filename="' . $filename . '"'
                    ]
                ]);

                $publicUrl = 'https://images.ulasimarsiv.com/' . $cloudPath;
                $this->log("Story görseli Firebase üzerinden public yapıldı: " . $publicUrl);
                return $publicUrl;
            } catch (\Throwable $e) {
                $this->log("Firebase Story Upload Hatası: " . $e->getMessage());
            }
        }

        return 'https://forum.ulasimarsiv.com' . $pathOnly;
    }

    // 7. Doğrudan Instagram Hikaye (Story) Paylaşımı
    public function postStoryToInstagram($igId, $imageUrl, $token)
    {
        try {
            $imageUrl = $this->resolvePublicImageUrl($imageUrl);

            // Container oluştur (media_type=STORIES)
            $res = $this->client->post("{$this->baseUrl}/{$igId}/media", [
                'form_params' => [
                    'image_url' => $imageUrl,
                    'media_type' => 'STORIES',
                    'access_token' => $token
                ]
            ]);
            $data = json_decode($res->getBody(), true);
            $creationId = $data['id'] ?? null;

            if (!$creationId) {
                throw new \Exception("Hikaye Container ID alınamadı.");
            }

            // Yayınla (3 saniye bekleme süresi)
            sleep(4);
            $pubRes = $this->client->post("{$this->baseUrl}/{$igId}/media_publish", [
                'form_params' => [
                    'creation_id' => $creationId,
                    'access_token' => $token
                ]
            ]);
            return json_decode($pubRes->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Instagram Hikaye Paylaşım Hatası: " . $e->getMessage());
            throw new \Exception("Hikaye Instagram'da paylaşılamadı: " . $e->getMessage());
        }
    }

    // 8. Gelen Mesajlar (Direct Messages / Conversations)
    public function getInstagramConversations($igId, $token, $limit = 20)
    {
        try {
            $fields = 'id,updated_time,participants,messages.limit(10){id,created_time,from,message}';
            $response = $this->client->get("{$this->baseUrl}/{$igId}/conversations", [
                'query' => [
                    'platform' => 'instagram',
                    'fields' => $fields,
                    'limit' => $limit,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Instagram Mesajlar Çekme Hatası: " . $e->getMessage());
            return ['data' => [], 'error' => $e->getMessage()];
        }
    }

    // 9. Belirli Bir Sohbetin Mesaj Geçmişi
    public function getConversationMessages($conversationId, $token, $limit = 25)
    {
        try {
            $fields = 'id,created_time,from,to,message,attachments';
            $response = $this->client->get("{$this->baseUrl}/{$conversationId}/messages", [
                'query' => [
                    'fields' => $fields,
                    'limit' => $limit,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Sohbet Mesaj Geçmişi Çekme Hatası: " . $e->getMessage());
            return ['data' => [], 'error' => $e->getMessage()];
        }
    }

    // ==========================================
    // --- FACEBOOK SAYFA YÖNETİMİ METODLARI ---
    // ==========================================

    // 10. Facebook Sayfa Profili
    public function getFacebookPageProfile($pageId, $token)
    {
        try {
            $fields = 'id,name,fan_count,followers_count,about,link,picture{url}';
            $response = $this->client->get("{$this->baseUrl}/{$pageId}", [
                'query' => [
                    'fields' => $fields,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Facebook Sayfa Profili Çekme Hatası: " . $e->getMessage());
            return null;
        }
    }

    // 11. Facebook Sayfa Insights
    public function getFacebookPageInsights($pageId, $token, $period = 'day')
    {
        try {
            $metrics = 'page_views_total,page_post_engagements,page_daily_follows';
            $response = $this->client->get("{$this->baseUrl}/{$pageId}/insights", [
                'query' => [
                    'metric' => $metrics,
                    'period' => $period,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Facebook Sayfa Insights Çekme Hatası: " . $e->getMessage());
            return ['data' => [], 'error' => $e->getMessage()];
        }
    }

    // 12. Facebook Sayfa Gönderileri
    public function getFacebookPageFeed($pageId, $token, $limit = 15)
    {
        try {
            $fields = 'id,message,created_time,full_picture,permalink_url,shares,likes.summary(true),comments.summary(true)';
            $response = $this->client->get("{$this->baseUrl}/{$pageId}/feed", [
                'query' => [
                    'fields' => $fields,
                    'limit' => $limit,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Facebook Sayfa Feed Çekme Hatası: " . $e->getMessage());
            return ['data' => []];
        }
    }

    // 13. Facebook Sayfa Mesajları (Messenger)
    public function getFacebookPageConversations($pageId, $token, $limit = 20)
    {
        try {
            $fields = 'id,updated_time,message_count,participants';
            $response = $this->client->get("{$this->baseUrl}/{$pageId}/conversations", [
                'query' => [
                    'fields' => $fields,
                    'limit' => $limit,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Facebook Messenger Çekme Hatası: " . $e->getMessage());
            return ['data' => []];
        }
    }

    // 14. Facebook Sayfasinda Hikaye (Story) Paylasma
    public function postStoryToFacebook($pageId, $imageUrl, $token)
    {
        try {
            $imageUrl = $this->resolvePublicImageUrl($imageUrl);

            // Sayfa Erişim Belirteci (Page Access Token) Al veya Mevcut Token'ı Kullan
            $pageToken = $this->getPageAccessToken($pageId, $token) ?: $token;

            // 1. Önce fotoğrafı yayınlanmamış olarak Facebook'a yükle (published = false)
            $photoResponse = $this->client->post("{$this->baseUrl}/{$pageId}/photos", [
                'form_params' => [
                    'url' => $imageUrl,
                    'published' => false,
                    'access_token' => $pageToken
                ]
            ]);
            $photoData = json_decode($photoResponse->getBody(), true);
            $photoId = $photoData['id'] ?? null;

            if ($photoId) {
                // 2. Elde edilen photo_id ile Facebook Page Story oluştur
                $response = $this->client->post("{$this->baseUrl}/{$pageId}/photo_stories", [
                    'form_params' => [
                        'photo_id' => $photoId,
                        'access_token' => $pageToken
                    ]
                ]);
                return json_decode($response->getBody(), true);
            }

            // Yedek / Doğrudan URL denemesi
            $response = $this->client->post("{$this->baseUrl}/{$pageId}/photo_stories", [
                'form_params' => [
                    'url' => $imageUrl,
                    'access_token' => $pageToken
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Facebook Hikaye Paylasma Hatasi: " . $e->getMessage());
            throw new \Exception("Hikaye Facebook'ta paylaşılamadı: " . $e->getMessage());
        }
    }

    // 15. Facebook Gonderi Yorumlarini Cekme
    public function getFacebookPostComments($postId, $token, $limit = 25)
    {
        try {
            $fields = 'id,message,created_time,from{id,name,picture},like_count,comments{id,message,from,created_time}';
            $response = $this->client->get("{$this->baseUrl}/{$postId}/comments", [
                'query' => [
                    'fields' => $fields,
                    'limit' => $limit,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Facebook Yorum Cekme Hatasi: " . $e->getMessage());
            return ['data' => []];
        }
    }

    // 16. Facebook Yorumuna Yanit Verme
    public function replyToFacebookComment($commentId, $message, $token)
    {
        try {
            $response = $this->client->post("{$this->baseUrl}/{$commentId}/comments", [
                'form_params' => [
                    'message' => $message,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Facebook Yorum Yanitlama Hatasi: " . $e->getMessage());
            throw new \Exception("Yoruma yanit verilemedi: " . $e->getMessage());
        }
    }

    // 17. Facebook Yorumunu Silme veya Gizleme
    public function deleteOrHideFacebookComment($commentId, $token, $hide = false)
    {
        try {
            if ($hide) {
                $response = $this->client->post("{$this->baseUrl}/{$commentId}", [
                    'form_params' => [
                        'is_hidden' => true,
                        'access_token' => $token
                    ]
                ]);
            } else {
                $response = $this->client->delete("{$this->baseUrl}/{$commentId}", [
                    'query' => ['access_token' => $token]
                ]);
            }
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Facebook Yorum Silme/Gizleme Hatasi: " . $e->getMessage());
            throw new \Exception("Facebook yorum islemi basarisiz: " . $e->getMessage());
        }
    }

    // 18. Facebook Messenger Sohbet Mesaj Detaylari
    public function getFacebookConversationMessages($conversationId, $token, $limit = 30)
    {
        try {
            $fields = 'id,created_time,from,to,message,attachments';
            $response = $this->client->get("{$this->baseUrl}/{$conversationId}/messages", [
                'query' => [
                    'fields' => $fields,
                    'limit' => $limit,
                    'access_token' => $token
                ]
            ]);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            $this->log("Facebook Messenger Mesaj Detay Hatasi: " . $e->getMessage());
            return ['data' => []];
        }
    }

    // 19. Threads Hesap Profili
    public function getThreadsProfile($threadsUserId, $token)
    {
        try {
            $fields = 'id,username,name,threads_profile_picture_url,threads_biography';
            $endpoints = [
                "https://graph.threads.net/v1.0/{$threadsUserId}",
                "https://graph.facebook.com/v19.0/{$threadsUserId}"
            ];
            foreach ($endpoints as $ep) {
                try {
                    $response = $this->client->get($ep, [
                        'query' => [
                            'fields' => $fields,
                            'access_token' => $token
                        ]
                    ]);
                    $data = json_decode($response->getBody(), true);
                    if ($data && isset($data['id'])) return $data;
                } catch (\Exception $e) {}
            }
            return null;
        } catch (\Exception $e) {
            $this->log("Threads Profil Cekme Hatasi: " . $e->getMessage());
            return null;
        }
    }

    // 20. Threads Son Gonderiler Listesi
    public function getThreadsMediaList($threadsUserId, $token, $limit = 15)
    {
        try {
            $fields = 'id,media_product_type,media_type,media_url,thumbnail_url,text,permalink,shortcode,timestamp,is_quote_post';
            $endpoints = [
                "https://graph.threads.net/v1.0/{$threadsUserId}/threads",
                "https://graph.facebook.com/v19.0/{$threadsUserId}/threads"
            ];
            foreach ($endpoints as $ep) {
                try {
                    $response = $this->client->get($ep, [
                        'query' => [
                            'fields' => $fields,
                            'limit' => $limit,
                            'access_token' => $token
                        ]
                    ]);
                    $data = json_decode($response->getBody(), true);
                    if ($data && isset($data['data'])) return $data;
                } catch (\Exception $e) {}
            }
            return ['data' => []];
        } catch (\Exception $e) {
            $this->log("Threads Gonderi Cekme Hatasi: " . $e->getMessage());
            return ['data' => []];
        }
    }

    // 21. Threads Hesap Insights
    public function getThreadsInsights($threadsUserId, $token)
    {
        try {
            $metrics = 'views,likes,replies,reposts,quotes';
            $endpoints = [
                "https://graph.threads.net/v1.0/{$threadsUserId}/threads_insights",
                "https://graph.facebook.com/v19.0/{$threadsUserId}/threads_insights"
            ];
            foreach ($endpoints as $ep) {
                try {
                    $response = $this->client->get($ep, [
                        'query' => [
                            'metric' => $metrics,
                            'access_token' => $token
                        ]
                    ]);
                    $data = json_decode($response->getBody(), true);
                    if ($data && (isset($data['values']) || isset($data['data']))) return $data;
                } catch (\Exception $e) {}
            }
            return ['data' => []];
        } catch (\Exception $e) {
            $this->log("Threads Insights Hatasi: " . $e->getMessage());
            return ['data' => []];
        }
    }
}
