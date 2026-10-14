<?php

namespace Framio\Widgets\ForumStatisticsWidget\Api;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Http\RequestUtil;
use Flarum\Http\UrlGenerator;
use Flarum\Post\Post;
use Flarum\User\User;
use Framio\Widgets\ForumStatisticsWidget\AddForumStats;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * GET /api/framio-stats/detail?days=30  İstatistik sayfası verisi (izin: framio-stats.viewPage)
 *
 * Bütün listeler izleyicinin görebildiği tartışma/mesajlarla sınırlıdır.
 */
class DetailController implements RequestHandlerInterface
{
    public function __construct(
        protected ConnectionInterface $db,
        protected AddForumStats $summary,
        protected UrlGenerator $url
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertCan('framio-stats.viewPage');

        $days = (int) Arr::get($request->getQueryParams(), 'days', 30);
        $days = in_array($days, [7, 30, 90], true) ? $days : 30;
        $since = Carbon::now()->subDays($days - 1)->startOfDay();

        $visibleDiscussions = Discussion::whereVisibleTo($actor)->select('id');

        return new JsonResponse([
            'days' => $days,
            'summary' => $this->summary->visibleStats($actor),
            'daily' => $this->daily($since, $days, $visibleDiscussions),
            'visitors' => $this->visitors($since, $visibleDiscussions),
            'topViewed' => $this->topViewed($actor, $since),
            'topViewedAllTime' => $this->topViewedAllTime($actor),
            'topPosts' => $this->topPosts($actor, $since),
            'topPosters' => $this->topPosters($actor, $since),
            'topTags' => $this->topTags($actor, $since),
        ]);
    }

    protected function series(Carbon $since, int $days, $rows): array
    {
        $map = collect($rows)->keyBy(fn ($r) => (string) $r->d);
        $out = [];
        for ($i = 0; $i < $days; $i++) {
            $d = $since->copy()->addDays($i)->toDateString();
            $out[] = (int) ($map[$d]->c ?? 0);
        }

        return $out;
    }

    protected function daily(Carbon $since, int $days, $visible): array
    {
        $dates = [];
        for ($i = 0; $i < $days; $i++) {
            $dates[] = $since->copy()->addDays($i)->toDateString();
        }

        $group = fn ($q, string $col) => $q->where($col, '>=', $since)->groupByRaw("DATE($col)")->selectRaw("DATE($col) as d, COUNT(*) as c")->get();

        $out = [
            'dates' => $dates,
            'discussions' => $this->series($since, $days, $group($this->db->table('discussions')->whereNull('hidden_at')->whereIn('id', $visible), 'created_at')),
            'posts' => $this->series($since, $days, $group($this->db->table('posts')->where('type', 'comment')->whereNull('hidden_at')->whereIn('discussion_id', $visible), 'created_at')),
            'users' => $this->series($since, $days, $group($this->db->table('users'), 'joined_at')),
            'views' => $this->series($since, $days, $this->db->table('framio_view_log')->where('post_id', 0)->where('viewed_on', '>=', $since->toDateString())->whereIn('discussion_id', $visible)->groupBy('viewed_on')->selectRaw('viewed_on as d, COUNT(*) as c')->get()),
            'visitors' => $this->series($since, $days, $this->db->table('framio_view_log')->where('viewed_on', '>=', $since->toDateString())->groupBy('viewed_on')->selectRaw('viewed_on as d, COUNT(DISTINCT visitor) as c')->get()),
        ];

        if ($this->db->getSchemaBuilder()->hasTable('spotter_images')) {
            $out['photos'] = $this->series($since, $days, $group($this->db->table('spotter_images'), 'created_at'));
        }

        return $out;
    }

    protected function visitors(Carbon $since, $visible): array
    {
        $q = fn () => $this->db->table('framio_view_log')->where('viewed_on', '>=', $since->toDateString())->whereIn('discussion_id', $visible);

        return [
            'members' => $q()->whereNotNull('user_id')->distinct()->count('user_id'),
            'guestVisits' => $q()->whereNull('user_id')->distinct()->count('visitor'),
            'discussionViews' => $q()->where('post_id', 0)->count(),
            'postViews' => $q()->where('post_id', '>', 0)->count(),
        ];
    }

    protected function discussionPayload(Discussion $d, int $count): array
    {
        return [
            'id' => $d->id,
            'title' => $d->title,
            'url' => $this->url->to('forum')->route('discussion', ['id' => $d->id . ($d->slug ? '-' . $d->slug : '')]),
            'count' => $count,
            'comments' => (int) $d->comment_count,
        ];
    }

    protected function topViewed(User $actor, Carbon $since): array
    {
        $rows = $this->db->table('framio_view_log')->where('post_id', 0)->where('viewed_on', '>=', $since->toDateString())
            ->groupBy('discussion_id')->selectRaw('discussion_id, COUNT(*) as c')->orderByDesc('c')->limit(40)->get();
        $discs = Discussion::whereVisibleTo($actor)->whereIn('id', $rows->pluck('discussion_id'))->get()->keyBy('id');

        return $rows->filter(fn ($r) => isset($discs[$r->discussion_id]))->take(10)
            ->map(fn ($r) => $this->discussionPayload($discs[$r->discussion_id], (int) $r->c))->values()->all();
    }

    protected function topViewedAllTime(User $actor): array
    {
        if (!$this->db->getSchemaBuilder()->hasColumn('discussions', 'view_count')) {
            return [];
        }

        return Discussion::whereVisibleTo($actor)->orderByDesc('view_count')->limit(10)->get()
            ->map(fn (Discussion $d) => $this->discussionPayload($d, (int) $d->view_count))->all();
    }

    protected function topPosts(User $actor, Carbon $since): array
    {
        $rows = $this->db->table('framio_view_log')->where('post_id', '>', 0)->where('viewed_on', '>=', $since->toDateString())
            ->groupBy('post_id')->selectRaw('post_id, COUNT(*) as c')->orderByDesc('c')->limit(40)->get();
        $posts = Post::whereVisibleTo($actor)->with(['discussion', 'user'])->whereIn('id', $rows->pluck('post_id'))->get()->keyBy('id');

        return $rows->filter(fn ($r) => isset($posts[$r->post_id]) && $posts[$r->post_id]->discussion)->take(10)->map(function ($r) use ($posts) {
            $p = $posts[$r->post_id];

            return [
                'title' => $p->discussion->title,
                'number' => (int) $p->number,
                'author' => $p->user ? $p->user->display_name : null,
                'url' => $this->url->to('forum')->route('discussion', ['id' => $p->discussion->id . ($p->discussion->slug ? '-' . $p->discussion->slug : ''), 'near' => $p->number]),
                'count' => (int) $r->c,
            ];
        })->values()->all();
    }

    protected function topPosters(User $actor, Carbon $since): array
    {
        $rows = Post::whereVisibleTo($actor)->where('type', 'comment')->whereNull('hidden_at')->whereNotNull('user_id')
            ->where('created_at', '>=', $since)->groupBy('user_id')->selectRaw('user_id, COUNT(*) as c')->orderByDesc('c')->limit(10)->get();
        $users = User::whereIn('id', $rows->pluck('user_id'))->get()->keyBy('id');

        return $rows->filter(fn ($r) => isset($users[$r->user_id]))->map(fn ($r) => [
            'username' => $users[$r->user_id]->username,
            'displayName' => $users[$r->user_id]->display_name,
            'avatarUrl' => $users[$r->user_id]->avatar_url,
            'url' => $this->url->to('forum')->route('user', ['username' => $users[$r->user_id]->username]),
            'count' => (int) $r->c,
        ])->values()->all();
    }

    protected function topTags(User $actor, Carbon $since): array
    {
        if (!class_exists(\Flarum\Tags\Tag::class) || !$this->db->getSchemaBuilder()->hasTable('discussion_tag')) {
            return [];
        }
        $visible = Discussion::whereVisibleTo($actor)->select('id');
        $rows = $this->db->table('posts')
            ->join('discussion_tag', 'discussion_tag.discussion_id', '=', 'posts.discussion_id')
            ->where('posts.type', 'comment')->whereNull('posts.hidden_at')->where('posts.created_at', '>=', $since)
            ->whereIn('posts.discussion_id', $visible)
            ->groupBy('discussion_tag.tag_id')->selectRaw($this->db->getTablePrefix() . 'discussion_tag.tag_id as tag_id, COUNT(*) as c')->orderByDesc('c')->limit(20)->get();
        $tags = \Flarum\Tags\Tag::whereVisibleTo($actor)->whereIn('id', $rows->pluck('tag_id'))->get()->keyBy('id');

        return $rows->filter(fn ($r) => isset($tags[$r->tag_id]))->take(8)->map(fn ($r) => [
            'name' => $tags[$r->tag_id]->name,
            'color' => $tags[$r->tag_id]->color,
            'icon' => $tags[$r->tag_id]->icon,
            'url' => $this->url->to('forum')->route('tag', ['slug' => $tags[$r->tag_id]->slug]),
            'count' => (int) $r->c,
        ])->values()->all();
    }
}
