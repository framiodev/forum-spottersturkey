<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Foundation\Paths;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Canlı güncelleme (sunucu soketi olmayan paylaşımlı barındırma için hafif yoklama):
 *   GET /framio/live?since=<son görülen mesaj kimliği>
 *   → rev: sitenin JS/CSS sürümü (değişince sekme kendini yeniler)
 *   → posts: since'ten sonraki, ziyaretçinin görebildiği yeni yorum mesajları (en fazla 10)
 */
class LiveController implements RequestHandlerInterface
{
    public function __construct(protected Paths $paths)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $since = (int) Arr::get($request->getQueryParams(), 'since', 0);

        $rev = '';
        $manifest = $this->paths->public . '/assets/rev-manifest.json';
        if (is_file($manifest)) {
            $json = json_decode((string) file_get_contents($manifest), true) ?: [];
            $rev = (string) (($json['forum.js'] ?? '') . ($json['forum.css'] ?? ''));
        }

        $latest = (int) Post::whereVisibleTo($actor)->where('type', 'comment')->max('id');
        $posts = [];
        if ($since > 0 && $latest > $since) {
            $posts = Post::whereVisibleTo($actor)->where('type', 'comment')->where('id', '>', $since)
                ->orderBy('id')->limit(10)->with(['user', 'discussion'])->get()
                ->filter(fn ($p) => $p->discussion)
                ->map(fn ($p) => [
                    'id' => (int) $p->id,
                    'number' => (int) $p->number,
                    'discussion_id' => (int) $p->discussion_id,
                    'title' => (string) $p->discussion->title,
                    'slug' => (string) $p->discussion->slug,
                    'user_id' => (int) $p->user_id,
                    'username' => $p->user ? $p->user->display_name : 'Bir üye',
                    'avatar' => $p->user ? $p->user->avatar_url : null,
                ])->values()->all();
        }

        return new JsonResponse(['rev' => $rev, 'latest' => $latest, 'posts' => $posts]);
    }
}
