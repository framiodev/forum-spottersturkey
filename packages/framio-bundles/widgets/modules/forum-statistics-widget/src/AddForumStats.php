<?php

namespace Framio\Widgets\ForumStatisticsWidget;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\User\User;

/**
 * Forum verisine tek bir "framioStats" alanı ekler. Her istatistik, izni olan
 * kullanıcıya gönderilir (admin → İzinler → Forum İstatistikleri).
 */
class AddForumStats
{
    /** istatistik anahtarı => gerekli izin */
    public const PERMISSIONS = [
        'discussions' => 'framio-stats.view.discussions',
        'tags' => 'framio-stats.view.discussions',
        'posts' => 'framio-stats.view.posts',
        'users' => 'framio-stats.view.users',
        'latestUser' => 'framio-stats.view.latestMember',
        'newMembers' => 'framio-stats.view.latestMember',
        'photos' => 'framio-stats.view.photos',
        'online' => 'framio-stats.view.online',
        'topWeek' => 'framio-stats.view.topWeek',
    ];

    public function __construct(protected StatsService $stats)
    {
    }

    public function __invoke(): array
    {
        return [
            Schema\Arr::make('framioStats')
                ->get(fn ($model, Context $context) => $this->visibleStats($context->getActor())),
        ];
    }

    public function visibleStats(User $actor): array
    {
        $all = $this->stats->get();
        $out = ['computedAt' => $all['computedAt'] ?? null];
        foreach (self::PERMISSIONS as $key => $permission) {
            if (isset($all[$key]) && $all[$key] !== null && $actor->can($permission)) {
                $out[$key] = $all[$key];
            }
        }

        return $out;
    }
}
