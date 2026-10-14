<?php

namespace FoF\OnlineUsers\Activity;

use Carbon\Carbon;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * POST /api/framio-activity         {type, subjectId?, extra?}  giriş yapmış üyenin etkinliğini kaydeder
 * GET  /api/framio-activity/online  çevrimiçi üyeler ve (izin varsa) ne yaptıkları
 */
class ActivityController implements RequestHandlerInterface
{
    public function __construct(
        protected ActivityResolver $activity,
        protected SettingsRepositoryInterface $settings
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        return $request->getMethod() === 'POST' ? $this->record($request, $actor) : $this->online($actor, (int) Arr::get($request->getQueryParams(), 'limit', 0));
    }

    protected function record(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        if ($actor->isGuest() || !$this->activity->enabled()) {
            return new EmptyResponse(204);
        }
        $body = (array) $request->getParsedBody();
        $subject = Arr::get($body, 'subjectId');
        $this->activity->record(
            $actor,
            (string) Arr::get($body, 'type', 'other'),
            is_numeric($subject) ? (int) $subject : null,
            Arr::get($body, 'extra') !== null ? (string) Arr::get($body, 'extra') : null
        );

        return new EmptyResponse(204);
    }

    /** $limit: widget ayardaki en fazla kişi sayısını, /cevrimici sayfası 100'e kadarını ister */
    protected function online(User $actor, int $limit = 0): ResponseInterface
    {
        if (!$actor->hasPermission('viewOnlineUsersWidget')) {
            return new JsonResponse(['data' => [], 'meta' => ['total' => 0]], 403);
        }

        $interval = $this->activity->freshMinutes();
        $max = $limit > 0 ? min(100, $limit) : max(1, min(100, (int) ($this->settings->get('fof-online-users-widget.max_users') ?: 15)));

        $query = User::query()
            ->whereVisibleTo($actor)
            ->where('last_seen_at', '>', Carbon::now()->subMinutes($interval));

        // Çevrimiçi durumunu gizleyenler (yöneticiler hariç) listede yer almaz
        if (!$actor->hasPermission('user.viewLastSeenAt')) {
            $query->where(fn ($q) => $q->whereNull('preferences')->orWhereNull('preferences->discloseOnline')->orWhere('preferences->discloseOnline', true));
        }

        $total = (clone $query)->count();
        $users = $query->orderByDesc('last_seen_at')->limit($max)->get();

        $canActivity = $this->activity->canView($actor);
        $rows = $canActivity ? $this->activity->rows($users->pluck('id')->all()) : [];

        $data = $users->map(function (User $u) use ($actor, $canActivity, $rows) {
            $activity = null;
            if ($canActivity && isset($rows[$u->id]) && $this->activity->discloses($u, $actor)) {
                $activity = $this->activity->describe($rows[$u->id], $actor, $u);
            }

            return [
                'id' => (int) $u->id,
                'username' => $u->username,
                'displayName' => $u->display_name,
                'avatarUrl' => $u->avatar_url,
                'lastSeenAt' => $u->last_seen_at?->toIso8601String(),
                'isMe' => (int) $u->id === (int) $actor->id,
                'activity' => $activity,
            ];
        })->values()->all();

        return new JsonResponse(['data' => $data, 'meta' => ['total' => $total, 'canViewActivity' => $canActivity, 'interval' => $interval]]);
    }
}
