<?php

/*
 * This file is part of fof/top-posters-widget.
 *
 * Copyright (c) 2021 FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\TopPosters;

use Framio\Widgets\ForumWidgets\SafeCacheRepositoryAdapter;
use Carbon\Carbon;
use Flarum\Extension\ExtensionManager;
use Flarum\Post\CommentPost;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Cache\Repository as IlluminateCache;

class UserRepository
{
    private const CACHE_KEY = 'fof-top-posters-widget.top_poster_counts';

    private ?array $memo = null;

    public function __construct(
        private SafeCacheRepositoryAdapter $cache,
        private SettingsRepositoryInterface $settings,
        private IlluminateCache $illuminateCache,
        private ExtensionManager $extensions
    ) {}

    public function getTopPosters(): array
    {
        if ($this->memo !== null) {
            return $this->memo;
        }

        return $this->memo = $this->cache->remember(self::CACHE_KEY, 43200, function (): array {
            $excludeGroups = $this->getExcludeGroups();

            $query = CommentPost::query()
                ->selectRaw('user_id, count(id) as count')
                ->where('created_at', '>', Carbon::now()->subMonth())
                ->groupBy('user_id')
                ->orderBy('count', 'desc')
                ->limit(5)
                ->toBase();

            if (!empty($excludeGroups)) {
                $query->whereNotIn('user_id', function ($q) use ($excludeGroups) {
                    $q->select('user_id')
                        ->from('group_user')
                        ->whereIn('group_id', $excludeGroups);
                });
            }

            if ($this->extensions->isEnabled('flarum-suspend')) {
                $query->whereNotIn('user_id', function ($q) {
                    $q->select('id')
                        ->from('users')
                        ->where('suspended_until', '>', Carbon::now());
                });
            }

            return $query->get()
                ->sortByDesc('count')
                ->mapWithKeys(function (\stdClass $post) {
                    return [$post->user_id => (int) $post->count];
                })
                ->toArray();
        }) ?: [];
    }

    private function getExcludeGroups(): array
    {
        return array_map('intval', json_decode($this->settings->get('fof-top-posters-widget.excludeGroups'), true) ?? []);
    }

    public function clearTopPosterCache(): bool
    {
        $this->memo = null;

        return $this->illuminateCache->forget(self::CACHE_KEY);
    }
}
