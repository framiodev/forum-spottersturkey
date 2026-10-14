<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\SocialShare\Services\CanvaService;
use Throwable;

class CanvaDesignController implements RequestHandlerInterface
{
    protected SettingsRepositoryInterface $settings;
    protected CanvaService $canva;

    public function __construct(SettingsRepositoryInterface $settings, CanvaService $canva)
    {
        $this->settings = $settings;
        $this->canva = $canva;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $session = $request->getAttribute('session');
        $isTeam = $this->canva->isTeamUser($actor);
        $body = $request->getParsedBody() ?? [];
        $action = $body['action'] ?? ($request->getQueryParams()['action'] ?? 'create');
        $accountType = $body['account_type'] ?? ($request->getQueryParams()['account_type'] ?? ($isTeam ? 'team' : 'brand'));

        $tokenData = null;
        $tokenSource = 'user';

        if ($accountType === 'brand') {
            $brandTokenRaw = $this->settings->get('framio-social-share.canva_brand_token');
            if ($brandTokenRaw) {
                $tokenData = json_decode($brandTokenRaw, true);
                $tokenSource = 'brand';
            }
        } else {
            if (!$actor->isGuest()) {
                $tokenData = $actor->getPreference('canva_token_data');
                $tokenSource = 'user';
            }
            if (!$tokenData && $session) {
                $tokenData = $session->get('canva_token_data');
                $tokenSource = 'user';
            }
            // Şahsi token yoksa marka token'ına yedekle
            if (!$tokenData || empty($tokenData['access_token'])) {
                $brandTokenRaw = $this->settings->get('framio-social-share.canva_brand_token');
                if ($brandTokenRaw) {
                    $tokenData = json_decode($brandTokenRaw, true);
                    $tokenSource = 'brand';
                }
            }
        }

        if (!$tokenData || empty($tokenData['access_token'])) {
            return new JsonResponse([
                'error' => ($accountType === 'brand') 
                    ? 'Ulaşım Arşiv Marka Canva Pro hesabı henüz bağlanmamış. Lütfen yöneticinizle iletişime geçin.'
                    : 'Şahsi Canva Pro oturumu bulunamadı. Lütfen önce Canva ile Bağlan butonuna tıklayın.'
            ], 401);
        }

        $authType = ($tokenSource === 'brand') ? 'brand' : ($isTeam ? 'team' : 'user');
        $clientId = $this->canva->getClientId($authType, $actor);
        $clientSecret = $this->canva->getClientSecret($authType, $actor);

        // Token Süresi Kontrolü ve Refresh (Kullanıcı veya Marka bazlı)
        if (isset($tokenData['expires_at']) && time() >= $tokenData['expires_at'] && !empty($tokenData['refresh_token'])) {
            try {
                $refreshed = $this->canva->refreshAccessToken($tokenData['refresh_token'], $clientId, $clientSecret);
                if (!empty($refreshed['access_token'])) {
                    $tokenData = array_merge($tokenData, $refreshed);
                    $tokenData['expires_at'] = time() + ($refreshed['expires_in'] ?? 14400);

                    if ($tokenSource === 'brand') {
                        $this->settings->set('framio-social-share.canva_brand_token', json_encode($tokenData));
                    } else {
                        if (!$actor->isGuest()) {
                            $actor->setPreference('canva_token_data', $tokenData);
                            $actor->save();
                        }
                        if ($session) {
                            $session->put('canva_token_data', $tokenData);
                        }
                    }
                }
            } catch (Throwable $e) {
                // Refresh hatası
            }
        }

        $accessToken = $tokenData['access_token'];
        $body = $request->getParsedBody() ?? [];
        $action = $body['action'] ?? ($request->getQueryParams()['action'] ?? 'create');

        // 1. Yeni Hikaye Tasarımı Başlat (Asset Yükle + Tasarım Aç)
        if ($action === 'create') {
            $imageUrl = trim($body['image_url'] ?? '');
            $title = trim($body['title'] ?? 'Ulaşım Arşiv Hikayesi');

            if (empty($imageUrl)) {
                return new JsonResponse(['error' => 'Görsel URL gereklidir.'], 400);
            }

            try {
                // 1. Görseli Canva'ya yükle
                $asset = $this->canva->uploadAsset($accessToken, $imageUrl, $title);
                $assetId = $asset['id'] ?? null;

                // 2. 9:16 Instagram Story tasarımı oluştur
                $design = $this->canva->createStoryDesign($accessToken, $assetId, $title);

                if (!$design || empty($design['id'])) {
                    return new JsonResponse([
                        'error' => 'Canva tasarımı oluşturulamadı.',
                        'asset' => $asset
                    ], 500);
                }

                // 3. Tasarımı 'Ulaşım Arşiv Forum Hikaye Paylaşımları' klasörüne taşı
                try {
                    $folderId = $this->canva->getOrCreateStoryFolder($accessToken, 'Ulaşım Arşiv Forum Hikaye Paylaşımları');
                    if ($folderId) {
                        $this->canva->moveDesignToFolder($accessToken, $design['id'], $folderId);
                    }
                } catch (Throwable $fe) {
                    // Klasör taşıma hatası tasarımı engellemesin
                }

                $urls = $design['urls'] ?? [];
                $editUrl = $urls['edit_url'] ?? ('https://www.canva.com/design/' . $design['id'] . '/edit');

                return new JsonResponse([
                    'success' => true,
                    'design_id' => $design['id'],
                    'title' => $design['title'] ?? $title,
                    'edit_url' => $editUrl,
                    'view_url' => $urls['view_url'] ?? null,
                    'thumbnail_url' => $design['thumbnail']['url'] ?? null,
                    'asset_id' => $assetId
                ]);
            } catch (Throwable $e) {
                return new JsonResponse([
                    'error' => 'Canva işlem hatası: ' . $e->getMessage()
                ], 500);
            }
        }

        // 2. Tasarımı Dışa Aktar (Export to PNG / MP4)
        if ($action === 'export') {
            $designId = trim($body['design_id'] ?? '');
            $format = trim($body['format'] ?? ($request->getQueryParams()['format'] ?? 'png'));
            if (!in_array($format, ['png', 'mp4'])) {
                $format = 'png';
            }

            if (empty($designId)) {
                return new JsonResponse(['error' => 'design_id parametresi gereklidir.'], 400);
            }

            try {
                $exportUrls = $this->canva->exportDesign($accessToken, $designId, $format);

                if (!$exportUrls || empty($exportUrls)) {
                    return new JsonResponse([
                        'error' => 'Tasarım dışa aktarılamadı veya henüz Canva tarafından işleniyor (Video işleme birkaç saniye sürebilir, lütfen tekrar deneyin).'
                    ], 500);
                }

                return new JsonResponse([
                    'success' => true,
                    'format' => $format,
                    'urls' => $exportUrls,
                    'image_url' => $exportUrls[0] ?? null,
                    'download_url' => $exportUrls[0] ?? null
                ]);
            } catch (Throwable $e) {
                return new JsonResponse([
                    'error' => 'Export hatası: ' . $e->getMessage()
                ], 500);
            }
        }

        return new JsonResponse(['error' => 'Bilinmeyen eylem'], 400);
    }
}
