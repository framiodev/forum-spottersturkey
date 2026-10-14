<?php

namespace Framio\SeoPack;

use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Google\Client;
use Google\Service\Indexing;
use Carbon\Carbon;
use Flarum\Settings\SettingsRepositoryInterface;

class ManualPingController implements RequestHandlerInterface
{
    protected $settings;

    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        \Flarum\Http\RequestUtil::getActor($request)->assertAdmin();

        $body = $request->getParsedBody();
        $urls = $body['urls'] ?? [];
        $ids = $body['ids'] ?? [];
        $types = $body['types'] ?? [];

        if (empty($urls)) {
            return new JsonResponse(['status' => 'error', 'message' => 'URL bulunamadı.'], 400);
        }

        try {
            $client = new Client();
            $client->addScope('https://www.googleapis.com/auth/indexing');

            $authenticated = false;

            $tokens = $this->settings->get('framio-seo.google_tokens');
            if ($tokens) {
                $clientId = $this->settings->get('framio-seo.google_client_id');
                $clientSecret = $this->settings->get('framio-seo.google_client_secret');
                if ($clientId && $clientSecret) {
                    $client->setClientId($clientId);
                    $client->setClientSecret($clientSecret);
                    $tokenArray = json_decode($tokens, true);
                    $client->setAccessToken($tokenArray);

                    if ($client->isAccessTokenExpired()) {
                        if ($client->getRefreshToken()) {
                            $newToken = $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                            if (!isset($newToken['error'])) {
                                $this->settings->set('framio-seo.google_tokens', json_encode($client->getAccessToken()));
                                $authenticated = true;
                            }
                        }
                    } else {
                        $authenticated = true;
                    }
                }
            }

            if (!$authenticated) {
                $keyFile = storage_path('service_account.json');
                if (file_exists($keyFile)) {
                    $client->setAuthConfig($keyFile);
                    $authenticated = true;
                }
            }

            if (!$authenticated) {
                $debugMsg = 'Google yetkilendirmesi bulunamadı. Lütfen Ayarlar sekmesinden Google ile Giriş yapın veya storage/service_account.json dosyasını yükleyin.';
                return new JsonResponse(['status' => 'error', 'message' => $debugMsg], 500);
            }

            $indexingService = new Indexing($client);
            $successCount = 0;
            $lastError = null;

            foreach ($urls as $index => $url) {
                $urlNotification = new Indexing\UrlNotification();
                $urlNotification->setUrl($url);
                $urlNotification->setType('URL_UPDATED');
                
                try {
                    $indexingService->urlNotifications->publish($urlNotification);
                    $successCount++;
                    
                    if (isset($ids[$index])) {
                        $type = $types[$index] ?? 'discussion';

                        if ($type === 'post') {
                            $post = Post::find($ids[$index]);
                            if ($post) {
                                $post->seo_last_sent_at = Carbon::now();
                                $post->save();
                            }
                        } else {
                            $discussion = Discussion::find($ids[$index]);
                            if ($discussion) {
                                $discussion->seo_last_sent_at = Carbon::now();
                                $discussion->save();
                            }
                        }
                    }
                } catch (\Exception $e) {
                    $lastError = $e->getMessage();
                    continue;
                }
            }

            if ($successCount > 0) {
                return new JsonResponse(['status' => 'success', 'message' => "$successCount adet URL başarıyla Ping'lendi."]);
            } else {
                $msg = 'Ping başarısız. URL GSC mülkünde olmayabilir.';
                if ($lastError) {
                    $msg .= ' Google Hatası: ' . $lastError;
                }
                return new JsonResponse(['status' => 'error', 'message' => $msg], 400);
            }

        } catch (\Exception $e) {
            return new JsonResponse(['status' => 'error', 'message' => 'API Hatası: ' . $e->getMessage()], 500);
        }
    }
}
