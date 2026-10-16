<?php

namespace Framio\CustomHomepage\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Post\CommentPost;
use Framio\CustomHomepage\Support\Explore;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Admin: Günün Fotoğrafı. Bugünün seçimi (otomatik / elle), dünün aday listesi,
 * elle seçme ve otomatiğe dönme.
 *
 * GET  /framio/explore/potd
 * POST /framio/explore/potd  { post_id }  (boş = otomatiğe dön)
 */
class ExplorePotdController implements RequestHandlerInterface
{
    public function __construct(protected Explore $explore)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        if ($request->getMethod() === 'POST') {
            $raw = Arr::get((array) $request->getParsedBody(), 'post_id');
            // Bağlantı da kabul edilir: …/d/123-baslik/7 ya da yalnızca mesaj kimliği
            $postId = $this->resolvePostId((string) $raw);
            if ($raw !== null && $raw !== '' && !$postId) {
                return new JsonResponse(['error' => 'Mesaj bulunamadı. Mesaj kimliği ya da mesaj bağlantısı girin.'], 422);
            }
            $this->explore->setManual($postId);
        }

        $potd = $this->explore->potd();
        $candidates = $this->explore->potdCandidates();
        $ids = array_values(array_unique(array_filter(array_merge([$potd['post_id']], array_keys($candidates)))));
        $posts = $this->explore->postsInOrder($ids);

        $card = function (CommentPost $p) use ($candidates) {
            preg_match('/\burl="([^"]+)"/', (string) $p->getRawOriginal('content'), $m);

            return [
                'id' => (int) $p->id,
                'title' => (string) ($p->discussion->title ?? ''),
                'url' => '/d/' . $p->discussion_id . '/' . $p->number,
                'image' => isset($m[1]) ? html_entity_decode($m[1]) : null,
                'author' => $p->user ? (string) $p->user->display_name : '',
                'score' => (float) ($candidates[$p->id] ?? 0),
            ];
        };

        return new JsonResponse([
            'today' => $potd + ['post' => ($p = $posts->firstWhere('id', $potd['post_id'])) ? $card($p) : null],
            'candidates' => $posts->filter(fn ($p) => isset($candidates[$p->id]))->map($card)->values()->all(),
            'resets_at' => \Carbon\Carbon::now()->addDay()->startOfDay()->toIso8601String(),
        ]);
    }

    protected function resolvePostId(string $raw): ?int
    {
        $raw = trim($raw);
        if ($raw === '') return null;
        if (ctype_digit($raw)) {
            return CommentPost::where('id', (int) $raw)->exists() ? (int) $raw : null;
        }
        if (preg_match('#/d/(\d+)[^/]*/(\d+)#', $raw, $m)) {
            return CommentPost::where('discussion_id', (int) $m[1])->where('number', (int) $m[2])->value('id');
        }

        return null;
    }
}
