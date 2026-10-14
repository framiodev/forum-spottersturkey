<?php

namespace Framio\SeoPack;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Flarum\Http\UrlGenerator;
use Flarum\Http\RequestUtil;
use Flarum\Discussion\Discussion;
use Google\Client;
use Google\Service\Indexing;
use Carbon\Carbon;

class ManualIndexController implements RequestHandlerInterface
{
    protected $url;

    public function __construct(UrlGenerator $url)
    {
        $this->url = $url;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if (!$actor->isAdmin()) {
            return new JsonResponse(['status' => 'error', 'message' => 'Yetkisiz erişim.'], 403);
        }

        $parsedBody = $request->getParsedBody();
        $targetUrl = $parsedBody['url'] ?? '';

        if (empty($targetUrl)) {
            return new JsonResponse(['status' => 'error', 'message' => 'URL parametresi eksik.'], 400);
        }

        $keyFile = storage_path('service_account.json');
        if (!file_exists($keyFile)) {
            return new JsonResponse(['status' => 'error', 'message' => 'service_account.json eksik.'], 500);
        }

        try {
            $client = new Client();
            $client->setAuthConfig($keyFile);
            $client->addScope('https://www.googleapis.com/auth/indexing');
            $indexingService = new Indexing($client);

            $urlNotification = new Indexing\UrlNotification();
            $urlNotification->setUrl($targetUrl);
            $urlNotification->setType('URL_UPDATED');

            $indexingService->urlNotifications->publish($urlNotification);

            // Veritabanındaki timestamp'i güncelleyelim (Konu linki ise)
            if (preg_match('/\/d\/(\d+)/', $targetUrl, $matches)) {
                $discussionId = $matches[1];
                $discussion = Discussion::find($discussionId);
                if ($discussion) {
                    $discussion->seo_last_sent_at = Carbon::now();
                    $discussion->save();
                }
            }

            return new JsonResponse([
                'status' => 'success',
                'message' => 'Bağlantı Google\'a başarıyla gönderildi!',
                'url' => $targetUrl
            ]);

        } catch (\Exception $e) {
            return new JsonResponse([
                'status' => 'error',
                'message' => 'Google API Hatası: ' . $e->getMessage()
            ], 500);
        }
    }
}
