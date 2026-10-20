<?php

namespace Framio\SocialShare\Services;

use Flarum\Settings\SettingsRepositoryInterface;
use GuzzleHttp\Client;
use Throwable;

class CanvaService
{
    protected SettingsRepositoryInterface $settings;
    protected Client $client;

    const CANVA_AUTH_URL = 'https://www.canva.com/api/oauth/authorize';
    const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';
    const CANVA_API_BASE = 'https://api.canva.com/rest/v1';

    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
        $this->client = new Client([
            'timeout' => 30,
            'verify' => false,
            'headers' => [
                'User-Agent' => \Framio\SocialShare\Services\Brand::get()['hashtag'] . '-CanvaApp/1.0'
            ]
        ]);
    }

    public function isTeamUser(?\Flarum\User\User $user = null): bool
    {
        if (!$user || $user->isGuest()) return false;
        
        $teamUsersStr = (string)$this->settings->get('framio-social-share.canva_team_users', '');
        $teamUsers = array_filter(array_map('trim', explode(',', strtolower($teamUsersStr))));
        
        $username = strtolower($user->username ?? '');
        $displayName = strtolower($user->display_name ?? '');
        $userId = (string)$user->id;

        return in_array($username, $teamUsers) || in_array($displayName, $teamUsers) || in_array($userId, $teamUsers);
    }

    public function getClientId(?string $type = null, ?\Flarum\User\User $user = null): string
    {
        if ($type === 'brand') {
            $brandId = trim((string)$this->settings->get('framio-social-share.canva_brand_client_id', ''));
            if (!empty($brandId)) return $brandId;
        }

        if ($type === 'team' || ($user && $this->isTeamUser($user))) {
            $teamId = trim((string)$this->settings->get('framio-social-share.canva_client_id', ''));
            if (!empty($teamId)) return $teamId;
        }

        if ($user && !$this->isTeamUser($user)) {
            $brandId = trim((string)$this->settings->get('framio-social-share.canva_brand_client_id', ''));
            if (!empty($brandId)) return $brandId;
        }

        return trim((string)$this->settings->get('framio-social-share.canva_client_id', ''));
    }

    public function getClientSecret(?string $type = null, ?\Flarum\User\User $user = null): string
    {
        if ($type === 'brand') {
            $brandSecret = trim((string)$this->settings->get('framio-social-share.canva_brand_client_secret', ''));
            if (!empty($brandSecret)) return $brandSecret;
        }

        if ($type === 'team' || ($user && $this->isTeamUser($user))) {
            $teamSecret = trim((string)$this->settings->get('framio-social-share.canva_client_secret', ''));
            if (!empty($teamSecret)) return $teamSecret;
        }

        if ($user && !$this->isTeamUser($user)) {
            $brandSecret = trim((string)$this->settings->get('framio-social-share.canva_brand_client_secret', ''));
            if (!empty($brandSecret)) return $brandSecret;
        }

        return trim((string)$this->settings->get('framio-social-share.canva_client_secret', ''));
    }

    public function getRedirectUri(): string
    {
        $baseUrl = rtrim((string)resolve('flarum.config')['url'], '/');
        $redirectUrl = $baseUrl . '/api/framio/social-share/canva/callback';
        // Canva https zorunluluğu için http'yi https yap
        if (strpos($redirectUrl, 'http://') === 0) {
            $redirectUrl = 'https://' . substr($redirectUrl, 7);
        }
        return $redirectUrl;
    }

    /**
     * PKCE Authorization URL üretir
     */
    public function generateAuthUrl(string $codeChallenge, string $state, ?string $type = null, ?\Flarum\User\User $user = null): string
    {
        $clientId = $this->getClientId($type, $user);
        $redirectUri = $this->getRedirectUri();

        $scopes = [
            'asset:write',
            'asset:read',
            'folder:write',
            'folder:read',
            'design:content:write',
            'design:content:read',
            'design:meta:read',
            'profile:read'
        ];

        $params = [
            'response_type' => 'code',
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'scope' => implode(' ', $scopes),
            'code_challenge' => $codeChallenge,
            'code_challenge_method' => 'S256',
            'state' => $state
        ];

        return self::CANVA_AUTH_URL . '?' . http_build_query($params);
    }

    /**
     * Authorization code ile Access Token takası (PKCE)
     */
    public function exchangeCodeForToken(string $code, string $codeVerifier, ?string $clientId = null, ?string $clientSecret = null): array
    {
        $clientId = $clientId ?: $this->getClientId();
        $clientSecret = $clientSecret ?: $this->getClientSecret();
        $redirectUri = $this->getRedirectUri();

        $response = $this->client->post(self::CANVA_TOKEN_URL, [
            'auth' => [$clientId, $clientSecret],
            'form_params' => [
                'grant_type' => 'authorization_code',
                'code_verifier' => $codeVerifier,
                'code' => $code,
                'redirect_uri' => $redirectUri
            ]
        ]);

        return json_decode((string)$response->getBody(), true);
    }

    /**
     * Refresh Token ile yeni Access Token alma
     */
    public function refreshAccessToken(string $refreshToken, ?string $clientId = null, ?string $clientSecret = null): array
    {
        $clientId = $clientId ?: $this->getClientId();
        $clientSecret = $clientSecret ?: $this->getClientSecret();

        $response = $this->client->post(self::CANVA_TOKEN_URL, [
            'auth' => [$clientId, $clientSecret],
            'form_params' => [
                'grant_type' => 'refresh_token',
                'refresh_token' => $refreshToken
            ]
        ]);

        return json_decode((string)$response->getBody(), true);
    }

    /**
     * Canva Kullanıcı Profilini Getir
     */
    public function getUserProfile(string $accessToken): ?array
    {
        try {
            $response = $this->client->get(self::CANVA_API_BASE . '/users/me/profile', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $accessToken
                ]
            ]);
            $body = json_decode((string)$response->getBody(), true);
            return $body['profile'] ?? null;
        } catch (Throwable $e) {
            return null;
        }
    }

    /**
     * Canva'ya Görsel Yükle (Asset Upload)
     */
    public function uploadAsset(string $accessToken, string $imageUrl, string $title = 'Story Image'): ?array
    {
        try {
            $imgBody = null;

            // 0. Base64 Data URI ise doğrudan decode et
            if (str_starts_with($imageUrl, 'data:image/') && str_contains($imageUrl, ';base64,')) {
                $parts = explode(';base64,', $imageUrl);
                if (!empty($parts[1])) {
                    $imgBody = base64_decode($parts[1]);
                }
            }

            // Eğer proxy URL geldiyse (örn: /proxy-image?url=...) içindeki gerçek URL'yi ayıkla
            if (!$imgBody && str_contains($imageUrl, 'proxy-image') && str_contains($imageUrl, 'url=')) {
                $query = parse_url($imageUrl, PHP_URL_QUERY);
                if ($query) {
                    parse_str($query, $queryParams);
                    if (!empty($queryParams['url'])) {
                        $imageUrl = $queryParams['url'];
                    }
                }
            }

            // 1. Yerel dosya yolu ise doğrudan diskten oku
            $parsed = parse_url($imageUrl);
            $path = $parsed['path'] ?? '';
            $basePath = dirname(dirname(dirname(dirname(__DIR__)))); // forum root: c:\xampp\htdocs\forum.ulasimarsiv.com
            
            $candidates = [
                $basePath . '/' . ltrim($path, '/'),
                $basePath . '/public/' . ltrim($path, '/'),
                $basePath . str_replace('/', DIRECTORY_SEPARATOR, $path)
            ];

            foreach ($candidates as $cand) {
                if (file_exists($cand) && is_file($cand)) {
                    $imgBody = @file_get_contents($cand);
                    if ($imgBody) break;
                }
            }

            if (empty($imgBody)) {
                // 2. HTTP / HTTPS üzerinden indir
                $imgRes = $this->client->get($imageUrl, [
                    'timeout' => 20,
                    'verify' => false,
                    'headers' => [
                        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' . \Framio\SocialShare\Services\Brand::get()['hashtag'] . '/1.0',
                        'Accept' => 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                    ]
                ]);
                $imgBody = (string)$imgRes->getBody();
            }

            if (empty($imgBody)) {
                return null;
            }

            // Temiz ASCII başlık veya base64
            $cleanTitle = preg_replace('/[^\x20-\x7E]/', '', $title) ?: 'Story Image';
            $cleanTitle = mb_substr($cleanTitle, 0, 45) . '.jpg';
            $metadata = [
                'name_base64' => base64_encode($cleanTitle)
            ];

            $response = $this->client->post(self::CANVA_API_BASE . '/asset-uploads', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $accessToken,
                    'Asset-Upload-Metadata' => json_encode($metadata),
                    'Content-Type' => 'application/octet-stream'
                ],
                'body' => $imgBody
            ]);

            $uploadJob = json_decode((string)$response->getBody(), true);
            $jobId = $uploadJob['job']['id'] ?? null;

            if (!$jobId) {
                return $uploadJob['asset'] ?? ($uploadJob['job']['asset'] ?? null);
            }

            // Upload işinin tamamlanmasını bekle (Polling - max 15 saniye)
            for ($i = 0; $i < 30; $i++) {
                usleep(500000); // 0.5s
                $statusRes = $this->client->get(self::CANVA_API_BASE . '/asset-uploads/' . $jobId, [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $accessToken
                    ]
                ]);
                $statusData = json_decode((string)$statusRes->getBody(), true);
                if (isset($statusData['job']['status']) && $statusData['job']['status'] === 'success') {
                    return $statusData['job']['asset'] ?? null;
                }
                if (isset($statusData['job']['status']) && $statusData['job']['status'] === 'failed') {
                    break;
                }
            }

            return null;
        } catch (Throwable $e) {
            return null;
        }
    }

    /**
     * Canva'da Fotoğrafı İçeren 9:16 Hikaye Tasarımı Oluştur (1080x1920)
     */
    public function createStoryDesign(string $accessToken, ?string $assetId = null, string $title = 'Forum Hikayesi'): ?array
    {
        // 1. Her zaman 1080x1920 (9:16 Dikey Hikaye) Özel Boyut + Asset ID ile oluştur
        try {
            $payload = [
                'design_type' => [
                    'type' => 'custom',
                    'width' => 1080,
                    'height' => 1920
                ],
                'title' => $title
            ];

            if ($assetId) {
                $payload['asset_id'] = $assetId;
            }

            $response = $this->client->post(self::CANVA_API_BASE . '/designs', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $accessToken,
                    'Content-Type' => 'application/json'
                ],
                'json' => $payload
            ]);

            $data = json_decode((string)$response->getBody(), true);
            if (!empty($data['design']['id'])) {
                return $data['design'];
            }
        } catch (Throwable $e) {
            // Hata durumunda asset_id ile yedek dene
        }

        // 2. Yedek: Doğrudan asset_id ile tasarımı oluşturmayı dene
        if ($assetId) {
            try {
                $payload = [
                    'asset_id' => $assetId,
                    'title' => $title
                ];

                $response = $this->client->post(self::CANVA_API_BASE . '/designs', [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $accessToken,
                        'Content-Type' => 'application/json'
                    ],
                    'json' => $payload
                ]);

                $data = json_decode((string)$response->getBody(), true);
                if (!empty($data['design']['id'])) {
                    return $data['design'];
                }
            } catch (Throwable $e) {
                return null;
            }
        }

        return null;
    }

    /**
     * Tasarımı Dışa Aktar (Export to PNG / MP4)
     */
    public function exportDesign(string $accessToken, string $designId, string $format = 'png'): ?array
    {
        try {
            $isMp4 = strtolower($format) === 'mp4';
            $formatPayload = [
                'type' => $isMp4 ? 'mp4' : 'png'
            ];

            if ($isMp4) {
                $formatPayload['quality'] = 'vertical_1080p';
            }

            $response = $this->client->post(self::CANVA_API_BASE . '/exports', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $accessToken,
                    'Content-Type' => 'application/json'
                ],
                'json' => [
                    'design_id' => $designId,
                    'format' => $formatPayload
                ]
            ]);

            $jobData = json_decode((string)$response->getBody(), true);
            $exportId = $jobData['job']['id'] ?? null;

            if (!$exportId) return null;

            // Export sonucunu bekle (MP4 render için 45sn, PNG için 20sn)
            $maxTries = $isMp4 ? 45 : 20;
            for ($i = 0; $i < $maxTries; $i++) {
                usleep(1000000); // 1s
                $statusRes = $this->client->get(self::CANVA_API_BASE . '/exports/' . $exportId, [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $accessToken
                    ]
                ]);
                $status = json_decode((string)$statusRes->getBody(), true);
                if (isset($status['job']['status']) && $status['job']['status'] === 'success') {
                    return $status['job']['urls'] ?? [];
                }
                if (isset($status['job']['status']) && $status['job']['status'] === 'failed') {
                    break;
                }
            }

            return null;
        } catch (Throwable $e) {
            return null;
        }
    }

    /**
     * Canva'da 'Ulaşım Arşiv Forum Hikaye Paylaşımları' klasörünü bul veya oluştur
     */
    public function getOrCreateStoryFolder(string $accessToken, string $folderName = 'Forum Hikaye Paylaşımları'): ?string
    {
        try {
            // 1. Önce Root içindeki klasörleri tara
            $res = $this->client->get(self::CANVA_API_BASE . '/folders/root/items', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $accessToken
                ]
            ]);

            $data = json_decode((string)$res->getBody(), true);
            $items = $data['items'] ?? [];

            foreach ($items as $item) {
                if (($item['type'] ?? '') === 'folder' && ($item['name'] ?? '') === $folderName) {
                    return $item['id'];
                }
            }

            // 2. Yoksa yeni klasör oluştur
            $createRes = $this->client->post(self::CANVA_API_BASE . '/folders', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $accessToken,
                    'Content-Type' => 'application/json'
                ],
                'json' => [
                    'name' => $folderName,
                    'parent_folder_id' => 'root'
                ]
            ]);

            $created = json_decode((string)$createRes->getBody(), true);
            return $created['folder']['id'] ?? null;
        } catch (Throwable $e) {
            return null;
        }
    }

    /**
     * Tasarımı Belirtilen Klasöre Taşı
     */
    public function moveDesignToFolder(string $accessToken, string $designId, string $folderId): bool
    {
        try {
            $response = $this->client->post(self::CANVA_API_BASE . '/folders/move', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $accessToken,
                    'Content-Type' => 'application/json'
                ],
                'json' => [
                    'item_id' => $designId,
                    'to_folder_id' => $folderId
                ]
            ]);

            return $response->getStatusCode() >= 200 && $response->getStatusCode() < 300;
        } catch (Throwable $e) {
            return false;
        }
    }
}
