<?php

namespace Framio\SeoPack;

use Flarum\Http\RequestUtil;
use Flarum\Post\CommentPost;
use Framio\SeoPack\Support\AltTextFixer;
use Framio\SeoPack\Support\SeoSettings;
use Google\Client;
use Google\Service\Indexing;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Görselli mesajların bulunduğu tartışma sayfalarını partiler halinde
 * Google Indexing API'ye bildirir. Google bu API'yi resmî olarak yalnızca
 * iş ilanı / canlı yayın sayfaları için destekler; bu yüzden özellik
 * varsayılan olarak kapalıdır ve admin panelinden açılmalıdır.
 */
class BatchIndexController implements RequestHandlerInterface
{
    private const BATCH_SIZE = 50;
    private const POSTS_PER_PAGE = 20;

    public function __construct(protected SeoSettings $seo, protected AltTextFixer $fixer)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        if (!$this->seo->bool('enable_indexing_api')) {
            return new JsonResponse(['status' => 'error', 'message' => 'Google Indexing API ayarlardan kapalı.'], 200);
        }

        try {
            $keyFile = storage_path('service_account.json');
            if (!file_exists($keyFile)) {
                return new JsonResponse(['status' => 'error', 'message' => 'storage/service_account.json dosyası eksik.'], 200);
            }

            $client = new Client();
            $client->setAuthConfig($keyFile);
            $client->addScope('https://www.googleapis.com/auth/indexing');
            $indexing = new Indexing($client);

            $tags = array_unique(array_merge(['framio-image', 'upl-image-preview'], $this->seo->recognizedTags()));
            $query = CommentPost::where('is_private', false)
                ->whereNull('hidden_at')
                ->where(function ($q) use ($tags) {
                    $q->where('content', 'like', '%<IMG %');
                    foreach ($tags as $tag) {
                        $q->orWhere('content', 'like', '%<' . strtoupper($tag) . '%');
                    }
                });

            $total = (clone $query)->count();
            $offset = $this->seo->int('last_batch_index');
            $posts = $query->orderBy('id')->skip($offset)->take(self::BATCH_SIZE)->with('discussion')->get();

            if ($posts->isEmpty()) {
                $this->seo->set('last_batch_index', '0');

                return new JsonResponse(['status' => 'success', 'message' => 'Tüm görselli mesajlar tarandı, başa dönüldü.', 'done' => true, 'total' => $total]);
            }

            $sent = [];
            foreach ($posts as $post) {
                $d = $post->discussion;
                if (!$d || $d->is_private || $d->hidden_at) {
                    continue;
                }

                $this->fixer->fix($post, false);

                $page = 1 + intdiv(max(0, $post->number - 1), self::POSTS_PER_PAGE);
                $url = $this->seo->baseUrl() . '/d/' . $d->id . ($d->slug ? '-' . $d->slug : '') . ($page > 1 ? '?page=' . $page : '');
                if (isset($sent[$url])) {
                    continue;
                }

                try {
                    $notification = new Indexing\UrlNotification();
                    $notification->setUrl($url);
                    $notification->setType('URL_UPDATED');
                    $indexing->urlNotifications->publish($notification);
                    $sent[$url] = true;

                    $post->seo_last_sent_at = \Carbon\Carbon::now();
                    $post->save();
                } catch (\Exception $e) {
                    continue;
                }
            }

            $next = $offset + $posts->count();
            $this->seo->set('last_batch_index', (string) $next);

            return new JsonResponse([
                'status' => 'success',
                'message' => count($sent) . " sayfa Google'a bildirildi.",
                'next_skip' => $next,
                'total' => $total,
            ]);
        } catch (\Exception $e) {
            return new JsonResponse(['status' => 'error', 'message' => 'API Hatası: ' . $e->getMessage()], 200);
        }
    }
}
