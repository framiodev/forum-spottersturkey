<?php

/*
 * This file is part of fof/online-users-widget.
 *
 * Copyright (c) 2021 Friends of Flarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\OnlineUsers;

use Carbon\Carbon;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Framio\Widgets\ForumWidgets\SafeCacheRepositoryAdapter;
use Illuminate\Database\Eloquent\Builder;

class UserRepository
{
    /**
     * @var array<callable(User): string>
     */
    protected static array $cacheKeyParameters = [];

    public static function addCacheKeyParameter(callable $parameter): void
    {
        static::$cacheKeyParameters[] = $parameter;
    }

    public function __construct(protected SettingsRepositoryInterface $settings, protected SafeCacheRepositoryAdapter $cache)
    {
    }

    protected function cacheKey(User $actor): string
    {
        $params = [
            $actor->hasPermission('user.viewLastSeenAt') ? 'high-access' : 'low-access',
            $this->settings->get('fof-online-users-widget.max_users'),
            $this->settings->get('fof-online-users-widget.cache_ttl'),
            $this->settings->get('fof-online-users-widget.last_seen_interval'),
        ];

        foreach (static::$cacheKeyParameters as $parameter) {
            $params[] = $parameter($actor);
        }

        return 'fof-online-users-widget.users-'.md5(implode('-', $params));
    }

    /**
     * Resolve the users to show as online, plus the total before the
     * `max_users` cap is applied.
     *
     * "Online" means `last_seen_at` within `last_seen_interval`. This is
     * deliberately the only definition: realtime's `presence-online` roster is
     * an exact list of live sockets, but it is also the *subscriber* list, and
     * subscribing requires `viewOnlineUsersWidget` — so on any forum that
     * restricts that permission the roster is a small subset of who is actually
     * online, and using it would shrink the list rather than sharpen it.
     * Realtime instead refetches this result when membership changes.
     *
     * @return array{users: int[], count: int}
     */
    public function getOnlineUserIds(User $actor): array
    {
        $limit = (int) $this->settings->get('fof-online-users-widget.max_users');
        $ttl = (int) $this->settings->get('fof-online-users-widget.cache_ttl');
        $interval = (int) $this->settings->get('fof-online-users-widget.last_seen_interval');

        $result = $this->cache->remember(
            $this->cacheKey($actor),
            $ttl,
            function () use ($actor, $limit, $interval) {
                $query = User::query()
                    ->select('id', 'preferences')
                    ->whereVisibleTo($actor)
                    ->where('last_seen_at', '>', Carbon::now()->subMinutes($interval));

                // user.viewLastSeenAt is a permission that allows viewing online state
                // regardless of the privacy preference not to be shown. Applied in SQL
                // so that the count and the list agree — counting before filtering
                // would let a viewer infer how many users had opted out.
                if (! $actor->hasPermission('user.viewLastSeenAt')) {
                    $this->whereDisclosesOnline($query);
                }

                $count = $query->count();

                return [
                    'users' => $query->limit($limit)->pluck('id')->all(),
                    'count' => $count,
                ];
            }
        );

        return $result ?: ['users' => [], 'count' => 0];
    }

    /**
     * Restrict to users who disclose their online status.
     *
     * `discloseOnline` defaults to true and is only persisted once the user
     * changes it, so "disclosed" covers a NULL preferences column, a
     * preferences object without the key, and the key set to true. Only an
     * explicit false opts out.
     *
     * Expressed with Laravel's JSON operators rather than raw SQL so it holds
     * on all four drivers core supports — `preferences` is a native JSON
     * column, so `->` translates per-grammar.
     */
    protected function whereDisclosesOnline(Builder $query): void
    {
        $query->where(function (Builder $query) {
            $query
                ->whereNull('preferences')
                ->orWhereNull('preferences->discloseOnline')
                ->orWhere('preferences->discloseOnline', true);
        });
    }

    /**
     * @return array{users: User[], count: int}
     */
    public function getOnlineUsers(User $actor): array
    {
        $online = $this->getOnlineUserIds($actor);

        if (empty($online['users'])) {
            return ['users' => [], 'count' => $online['count']];
        }

        return [
            // Re-checked against the visibility scope rather than trusting the
            // cached ids, so a visibility change takes effect immediately
            // instead of after cache_ttl.
            'users' => User::query()
                ->whereVisibleTo($actor)
                ->whereIn('id', $online['users'])
                ->get()
                ->all(),
            'count' => $online['count'],
        ];
    }
}
