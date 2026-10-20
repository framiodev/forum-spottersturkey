<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Laminas\Diactoros\Response\HtmlResponse;
use Framio\SocialShare\Services\CanvaService;
use Throwable;

class CanvaAuthController implements RequestHandlerInterface
{
    protected SettingsRepositoryInterface $settings;
    protected CanvaService $canva;
    protected CacheRepository $cache;

    public function __construct(SettingsRepositoryInterface $settings, CanvaService $canva, CacheRepository $cache)
    {
        $this->settings = $settings;
        $this->canva = $canva;
        $this->cache = $cache;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $queryParams = $request->getQueryParams();
        $session = $request->getAttribute('session');
        $path = $request->getUri()->getPath();

        // 1. Callback (Canva Yönlendirmesi ve Yetki Kodu Takası)
        if (isset($queryParams['code']) || isset($queryParams['error']) || str_ends_with($path, '/callback') || ($queryParams['action'] ?? '') === 'callback') {
            $code = $queryParams['code'] ?? '';
            $state = $queryParams['state'] ?? '';
            $error = $queryParams['error'] ?? '';
            $errorDesc = $queryParams['error_description'] ?? '';

            $noCacheHeaders = [
                'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma' => 'no-cache',
                'Expires' => '0',
                'X-LiteSpeed-Cache-Control' => 'no-cache'
            ];

            if (!empty($error)) {
                $errHtml = "
                <!DOCTYPE html>
                <html lang='tr'>
                <head>
                    <meta charset='utf-8'>
                    <title>Canva İzin Hatası</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
                        .card { background: #1e293b; padding: 32px 24px; border-radius: 16px; border: 1.5px solid #ef4444; max-width: 440px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
                        h3 { color: #f87171; margin-top: 0; font-size: 20px; }
                        p { color: #cbd5e1; font-size: 14px; line-height: 1.5; }
                        .code-box { background: #0f172a; padding: 10px; border-radius: 8px; font-family: monospace; font-size: 12px; color: #fca5a5; margin: 15px 0; word-break: break-all; }
                        button { background: #ef4444; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; }
                    </style>
                </head>
                <body>
                    <div class='card'>
                        <div style='font-size: 40px; margin-bottom: 10px;'>⚠️</div>
                        <h3>Canva Bağlantı İzni Verilemedi</h3>
                        <p>Canva üzerinden yetkilendirme yapılırken bir hata oluştu:</p>
                        <div class='code-box'>" . htmlspecialchars($error . ($errorDesc ? ': ' . $errorDesc : '')) . "</div>
                        <button onclick='window.close()'>Pencereyi Kapat</button>
                    </div>
                </body>
                </html>";
                return new HtmlResponse($errHtml, 400, $noCacheHeaders);
            }

            if (empty($code)) {
                $emptyHtml = "
                <!DOCTYPE html>
                <html lang='tr'>
                <head>
                    <meta charset='utf-8'>
                    <title>Canva Bağlantısı</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
                        .card { background: #1e293b; padding: 32px 24px; border-radius: 16px; border: 1.5px solid #64748b; max-width: 440px; text-align: center; }
                        h3 { color: #94a3b8; margin-top: 0; }
                        p { color: #cbd5e1; font-size: 14px; }
                        button { background: #475569; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; }
                    </style>
                </head>
                <body>
                    <div class='card'>
                        <div style='font-size: 40px; margin-bottom: 10px;'>ℹ️</div>
                        <h3>Canva Yetki Kodu Alınamadı</h3>
                        <p>Bağlantı isteği iptal edilmiş veya yetki kodu bulunamamış olabilir.</p>
                        <button onclick='window.close()'>Pencereyi Kapat</button>
                    </div>
                </body>
                </html>";
                return new HtmlResponse($emptyHtml, 400, $noCacheHeaders);
            }

            try {
                $verifier = $this->cache->get('canva_pkce_' . $state);
                if (empty($verifier) && $session) {
                    $verifier = $session->get('canva_pkce_verifier');
                }
                if (empty($verifier)) {
                    $verifier = bin2hex(random_bytes(32));
                }

                $authType = $this->cache->get('canva_auth_type_' . $state) ?: 'user';
                $userId = $this->cache->get('canva_auth_user_' . $state);
                $targetUser = $userId ? \Flarum\User\User::find($userId) : $actor;

                $clientId = $this->canva->getClientId($authType, $targetUser);
                $clientSecret = $this->canva->getClientSecret($authType, $targetUser);

                $tokenData = $this->canva->exchangeCodeForToken($code, $verifier, $clientId, $clientSecret);

                if (isset($tokenData['access_token'])) {
                    $profile = $this->canva->getUserProfile($tokenData['access_token']);
                    $tokenData['expires_at'] = time() + ($tokenData['expires_in'] ?? 14400);

                    // Eğer Marka Hesabı Bağlanıyorsa (Merkezi Ayarlara Kaydet)
                    if ($authType === 'brand') {
                        $this->settings->set('framio-social-share.canva_brand_token', json_encode($tokenData));
                        if ($profile) {
                            $this->settings->set('framio-social-share.canva_brand_profile', json_encode($profile));
                        }
                    } else {
                        // Kullanıcının kendi profiline kaydet (Per-User Gizlilik)
                        if ($targetUser && !$targetUser->isGuest()) {
                            try {
                                $targetUser->setPreference('canva_token_data', $tokenData);
                                if ($profile) {
                                    $targetUser->setPreference('canva_user_profile', $profile);
                                }
                                $targetUser->save();
                            } catch (Throwable $pe) {}

                            $this->cache->put('canva_user_token_' . $targetUser->id, $tokenData, 86400 * 365);
                            if ($profile) {
                                $this->cache->put('canva_user_profile_' . $targetUser->id, $profile, 86400 * 365);
                            }
                        }

                        if ($session) {
                            $session->put('canva_token_data', $tokenData);
                            $session->put('canva_user_profile', $profile);
                        }
                    }

                    $displayName = $profile['display_name'] ?? ($authType === 'brand' ? \Framio\SocialShare\Services\Brand::get()['name'] . ' Marka Hesabı' : 'Canva Kullanıcısı');

                    $html = "
                    <!DOCTYPE html>
                    <html>
                    <head><meta charset='utf-8'><title>Canva Bağlandı</title></head>
                    <body style='background:#0f172a;margin:0;'>
                        <script>
                            var profileData = " . json_encode($profile) . ";
                            try {
                                localStorage.setItem('framio_canva_auth_event', JSON.stringify({ time: Date.now(), success: true, profile: profileData, auth_type: '" . $authType . "' }));
                            } catch(e) {}
                            try {
                                if (window.opener) {
                                    window.opener.postMessage({ type: 'CANVA_AUTH_SUCCESS', profile: profileData, auth_type: '" . $authType . "' }, '*');
                                }
                            } catch(e) {}
                            window.close();
                            // Fallback if browser blocks immediate window.close()
                            setTimeout(function() { window.close(); }, 300);
                        </script>
                    </body>
                    </html>";
                    return new HtmlResponse($html);
                } else {
                    $errMsg = $tokenData['error_description'] ?? ($tokenData['error'] ?? 'Token alınamadı.');
                    return new HtmlResponse("
                    <!DOCTYPE html>
                    <html>
                    <head><meta charset='utf-8'><title>Hata</title><style>body{background:#0f172a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}.card{background:#1e293b;padding:30px;border-radius:12px;border:1px solid #ef4444;max-width:400px;}</style></head>
                    <body>
                        <div class='card'>
                            <h3 style='color:#ef4444;'>Canva Bağlantı Hatası</h3>
                            <p style='color:#cbd5e1;font-size:14px;'>" . htmlspecialchars($errMsg) . "</p>
                            <button onclick='window.close()' style='background:#ef4444;color:#fff;border:none;padding:10px 18px;border-radius:6px;cursor:pointer;font-weight:700;'>Pencereyi Kapat</button>
                        </div>
                    </body>
                    </html>");
                }
            } catch (Throwable $e) {
                return new HtmlResponse("
                <!DOCTYPE html>
                <html>
                <head><meta charset='utf-8'><title>Hata</title><style>body{background:#0f172a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}.card{background:#1e293b;padding:30px;border-radius:12px;border:1px solid #ef4444;max-width:400px;}</style></head>
                <body>
                    <div class='card'>
                        <h3 style='color:#ef4444;'>Sistem Bağlantı Hatası</h3>
                        <p style='color:#cbd5e1;font-size:14px;'>" . htmlspecialchars($e->getMessage()) . "</p>
                        <button onclick='window.close()' style='background:#ef4444;color:#fff;border:none;padding:10px 18px;border-radius:6px;cursor:pointer;font-weight:700;'>Pencereyi Kapat</button>
                    </div>
                </body>
                </html>");
            }
        }

        $action = $queryParams['action'] ?? ($request->getAttribute('action') ?? 'status');

        // 2. Auth URL Üretimi (Başlatma)
        if ($action === 'auth-url') {
            $actor->assertRegistered();

            $authType = $queryParams['account_type'] ?? ($this->canva->isTeamUser($actor) ? 'team' : 'brand');

            $clientId = $this->canva->getClientId($authType, $actor);
            $clientSecret = $this->canva->getClientSecret($authType, $actor);

            if (empty($clientId) || empty($clientSecret)) {
                return new JsonResponse([
                    'error' => ($authType === 'brand' ? 'Marka Canva Client ID ve Secret' : 'Şahsi Canva Client ID ve Secret') . ' henüz Admin Panelinden tanımlanmamış.'
                ], 400);
            }

            // PKCE Code Verifier & Challenge
            $verifier = bin2hex(random_bytes(32));
            $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
            $state = bin2hex(random_bytes(16));

            $this->cache->put('canva_pkce_' . $state, $verifier, 600); // 10 dakika sakla
            $this->cache->put('canva_auth_user_' . $state, $actor->id, 600);
            $this->cache->put('canva_auth_type_' . $state, $authType, 600);

            if ($session) {
                $session->put('canva_pkce_verifier', $verifier);
                $session->put('canva_auth_state', $state);
                $session->put('canva_user_id', $actor->id);
                $session->put('canva_auth_type', $authType);
            }

            $url = $this->canva->generateAuthUrl($challenge, $state, $authType, $actor);

            return new JsonResponse([
                'auth_url' => $url,
                'state' => $state,
                'auth_type' => $authType
            ]);
        }

        // 3. Durum Kontrolü (Status - Bireysel & Marka Uyumu)
        if ($action === 'status') {
            $isTeam = $this->canva->isTeamUser($actor);
            
            // 1. Şahsi kullanıcı token'ı
            $userToken = null;
            $userProfile = null;
            if (!$actor->isGuest()) {
                $userToken = $actor->getPreference('canva_token_data') ?: $this->cache->get('canva_user_token_' . $actor->id);
                $userProfile = $actor->getPreference('canva_user_profile') ?: $this->cache->get('canva_user_profile_' . $actor->id);
            }

            // 2. Marka ortak hesap token'ı
            $brandTokenRaw = $this->settings->get('framio-social-share.canva_brand_token');
            $brandProfileRaw = $this->settings->get('framio-social-share.canva_brand_profile');
            $brandToken = $brandTokenRaw ? json_decode($brandTokenRaw, true) : null;
            $brandProfile = $brandProfileRaw ? json_decode($brandProfileRaw, true) : null;

            $teamClientId = $this->canva->getClientId('team');
            $teamClientSecret = $this->canva->getClientSecret('team');
            $hasTeamKeys = !empty($teamClientId) && !empty($teamClientSecret);

            $brandClientId = $this->canva->getClientId('brand');
            $brandClientSecret = $this->canva->getClientSecret('brand');
            $hasBrandKeys = !empty($brandClientId) && !empty($brandClientSecret);

            $userConnected = !empty($userToken['access_token']);
            $brandConnected = !empty($brandToken['access_token']);

            return new JsonResponse([
                'is_team_user' => $isTeam,
                'user_connected' => $userConnected,
                'user_profile' => $userProfile,
                'brand_connected' => $brandConnected,
                'brand_profile' => $brandProfile ?: ($brandConnected ? ['display_name' => trim(\Framio\SocialShare\Services\Brand::get()['name'] . (\Framio\SocialShare\Services\Brand::get()['email'] ? ' (' . \Framio\SocialShare\Services\Brand::get()['email'] . ')' : ''))] : null),
                'team_has_keys' => $hasTeamKeys,
                'brand_has_keys' => $hasBrandKeys,
                'connected' => $userConnected || $brandConnected
            ]);
        }

        // 4. Bağlantıyı Kes (Disconnect)
        if ($action === 'disconnect') {
            $actor->assertRegistered();
            $authType = $queryParams['account_type'] ?? 'user';

            if ($authType === 'brand' && $actor->isAdmin()) {
                $this->settings->set('framio-social-share.canva_brand_token', null);
                $this->settings->set('framio-social-share.canva_brand_profile', null);
            } else if (!$actor->isGuest()) {
                try {
                    $actor->setPreference('canva_token_data', null);
                    $actor->setPreference('canva_user_profile', null);
                    $actor->save();
                } catch (Throwable $pe) {}

                $this->cache->forget('canva_user_token_' . $actor->id);
                $this->cache->forget('canva_user_profile_' . $actor->id);
            }

            if ($session) {
                $session->forget('canva_token_data');
                $session->forget('canva_user_profile');
                $session->forget('canva_pkce_verifier');
                $session->forget('canva_auth_state');
                $session->forget('canva_user_id');
            }
            return new JsonResponse(['success' => true]);
        }

        return new JsonResponse(['error' => 'Geçersiz işlem'], 400);
    }
}
