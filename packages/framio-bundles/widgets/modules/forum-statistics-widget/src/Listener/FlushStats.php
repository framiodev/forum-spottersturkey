<?php

namespace Framio\Widgets\ForumStatisticsWidget\Listener;

use Flarum\Discussion\Event as DiscussionEvent;
use Flarum\Post\Event as PostEvent;
use Flarum\User\Event as UserEvent;
use Framio\Widgets\ForumStatisticsWidget\StatsService;
use Illuminate\Contracts\Events\Dispatcher;

/**
 * İçerik ya da üye sayısını değiştiren her olayda istatistik önbelleği temizlenir;
 * böylece sayılar önbellek süresini beklemeden güncel olur.
 */
class FlushStats
{
    public function __construct(protected StatsService $stats)
    {
    }

    public function subscribe(Dispatcher $events): void
    {
        $events->listen([
            DiscussionEvent\Started::class,
            DiscussionEvent\Deleted::class,
            DiscussionEvent\Hidden::class,
            DiscussionEvent\Restored::class,
            PostEvent\Posted::class,
            PostEvent\Deleted::class,
            PostEvent\Hidden::class,
            PostEvent\Restored::class,
            UserEvent\Registered::class,
            UserEvent\Activated::class,
            UserEvent\Deleting::class,
            UserEvent\Deleted::class,
        ], [$this, 'flush']);
    }

    public function flush(): void
    {
        $this->stats->flush();
    }
}
