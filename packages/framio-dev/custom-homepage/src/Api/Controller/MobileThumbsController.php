<?php

namespace Framio\CustomHomepage\Api\Controller;

use Flarum\Discussion\Discussion;
use Flarum\Http\RequestUtil;
use Flarum\Post\CommentPost;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Telefon görünümü için küçük görseller:
 *  - ?tags=1,2,3        → her kategorinin en son fotoğrafı (alt kategori halkaları)
 *  - ?discussions=4,5,6 → her tartışmanın ilk fotoğrafı (tartışma satırları)
 * Yalnızca isteyenin görebildiği tartışmalara bakılır; misafir yanıtı 30 dk önbellekte tutulur.
 */
class MobileThumbsController implements RequestHandlerInterface
{
    private const MAX = 40;

    public function __construct(protected Cache $cache)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $q = $request->getQueryParams();
        $ids = fn ($key) => array_slice(array_values(array_unique(array_filter(array_map('intval', explode(',', (string) ($q[$key] ?? '')))))), 0, self::MAX);
        $tags = $ids('tags');
        $discussions = $ids('discussions');

        $build = function () use ($actor, $request, $tags, $discussions) {
            $out = ['tags' => [], 'discussions' => []];

            foreach ($tags as $tagId) {
                // Kategoriye ait son tartışmalar sırayla denenir; fotoğraflı ilk mesajın ilk görseli
                $list = Discussion::whereVisibleTo($actor)
                    ->whereIn('id', fn ($s) => $s->select('discussion_id')->from('discussion_tag')->where('tag_id', $tagId))
                    ->orderByDesc('last_posted_at')->limit(5)->get();
                foreach ($list as $d) {
                    if ($url = $this->latestImage($d, $actor, $request)) {
                        $out['tags'][$tagId] = $url;
                        break;
                    }
                }
            }

            if ($discussions) {
                foreach (Discussion::whereVisibleTo($actor)->whereIn('id', $discussions)->get() as $d) {
                    if ($url = $this->firstImage($d, $request)) {
                        $out['discussions'][$d->id] = $url;
                    }
                }
            }

            return $out;
        };

        $data = $actor->isGuest()
            ? $this->cache->remember('framio_mobile_thumbs_' . md5(implode(',', $tags) . '|' . implode(',', $discussions)), 1800, $build)
            : $build();

        return new JsonResponse($data);
    }

    private function firstImage(Discussion $d, ServerRequestInterface $request): ?string
    {
        $post = $d->firstPost;
        return $post instanceof CommentPost ? $this->imageFrom($post, $request) : null;
    }

    private function latestImage(Discussion $d, User $actor, ServerRequestInterface $request): ?string
    {
        $posts = $d->comments()->whereVisibleTo($actor)->orderByDesc('number')->limit(5)->get();
        foreach ($posts as $post) {
            if ($post instanceof CommentPost && ($url = $this->imageFrom($post, $request))) {
                return $url;
            }
        }

        return null;
    }

    // Mesajın biçimlenmiş HTML'indeki ilk görsel (akıştaki kartlarla aynı adres)
    private function imageFrom(CommentPost $post, ServerRequestInterface $request): ?string
    {
        try {
            $html = $post->formatContent($request);
        } catch (\Throwable $e) {
            return null;
        }
        if (preg_match('/<img\b(?![^>]*\bemoji\b)[^>]*\bsrc="([^"]+)"/i', (string) $html, $m)) {
            return html_entity_decode($m[1]);
        }

        return null;
    }
}
