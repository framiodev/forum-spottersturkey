<?php

namespace Framio\Widgets\ForumStatisticsWidget\Views;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * POST /api/framio-views                    {discussionId, postIds[]}  ekranda görülen mesajlar
 * GET  /api/framio-views/{kind}/{id}        kind = post | discussion; kimler görüntüledi
 *                                           (izin: framio-stats.viewViewers)
 */
class ViewsController implements RequestHandlerInterface
{
    public function __construct(protected ViewRecorder $recorder, protected ConnectionInterface $db)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        if ($request->getMethod() === 'POST') {
            $body = (array) $request->getParsedBody();
            $server = $request->getServerParams();
            $this->recorder->recordPosts(
                (int) Arr::get($body, 'discussionId'),
                (array) Arr::get($body, 'postIds', []),
                $actor,
                Arr::get($server, 'REMOTE_ADDR'),
                $request->getHeaderLine('User-Agent') ?: null
            );

            return new EmptyResponse(204);
        }

        $params = $request->getAttribute('routeParameters', []);

        return $this->viewers($actor, (string) Arr::get($params, 'kind'), (int) Arr::get($params, 'id'));
    }

    protected function viewers(User $actor, string $kind, int $id): ResponseInterface
    {
        $actor->assertCan('framio-stats.viewViewers');

        if ($kind === 'post') {
            $post = Post::whereVisibleTo($actor)->find($id);
            if (!$post) {
                return new JsonResponse(['errors' => [['status' => '404']]], 404);
            }
            $q = fn () => $this->db->table('framio_view_log')->where('post_id', $post->id);
            $title = $post->discussion ? $post->discussion->title . ' · #' . $post->number : '#' . $post->number;
        } else {
            $disc = Discussion::whereVisibleTo($actor)->find($id);
            if (!$disc) {
                return new JsonResponse(['errors' => [['status' => '404']]], 404);
            }
            $q = fn () => $this->db->table('framio_view_log')->where('discussion_id', $disc->id)->where('post_id', 0);
            $title = $disc->title;
        }

        // Üyeler: en son ne zaman gördü, kaç farklı gün
        $members = $q()->whereNotNull('user_id')
            ->groupBy('user_id')
            ->selectRaw('user_id, MAX(created_at) as last_at, COUNT(*) as days')
            ->orderByDesc('last_at')
            ->limit(100)
            ->get();
        $users = User::whereIn('id', $members->pluck('user_id'))->get()->keyBy('id');

        // Son 14 gün: günlük tekil görüntülenme (üye / ziyaretçi)
        $since = Carbon::now()->subDays(13)->startOfDay();
        $daily = $q()->where('viewed_on', '>=', $since->toDateString())
            ->groupBy('viewed_on')
            ->selectRaw('viewed_on, SUM(user_id IS NOT NULL) as members, SUM(user_id IS NULL) as guests')
            ->get()
            ->keyBy(fn ($r) => (string) $r->viewed_on);
        $days = [];
        for ($i = 0; $i < 14; $i++) {
            $d = $since->copy()->addDays($i)->toDateString();
            $row = $daily[$d] ?? null;
            $days[] = ['date' => $d, 'members' => (int) ($row->members ?? 0), 'guests' => (int) ($row->guests ?? 0)];
        }

        return new JsonResponse([
            'title' => $title,
            'total' => $q()->count(),
            'memberViews' => $q()->whereNotNull('user_id')->count(),
            'guestViews' => $q()->whereNull('user_id')->count(),
            'uniqueMembers' => $members->count(),
            'daily' => $days,
            'members' => $members->map(function ($m) use ($users) {
                $u = $users[$m->user_id] ?? null;

                return $u ? [
                    'username' => $u->username,
                    'displayName' => $u->display_name,
                    'avatarUrl' => $u->avatar_url,
                    'lastAt' => $m->last_at ? Carbon::parse($m->last_at)->toIso8601String() : null,
                    'days' => (int) $m->days,
                ] : null;
            })->filter()->values()->all(),
        ]);
    }
}
