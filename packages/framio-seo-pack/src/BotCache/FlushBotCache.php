<?php

namespace Framio\SeoPack\BotCache;

use Flarum\Discussion\Event as DiscussionEvent;
use Flarum\Post\Event as PostEvent;
use Illuminate\Contracts\Events\Dispatcher;

/**
 * İçerik değiştiğinde bot önbelleğini temizler; botlar her zaman güncel sayfayı görür.
 * (Forum boyutunda tamamını temizlemek, sayfa sayfa izlemekten daha güvenilirdir.)
 */
class FlushBotCache
{
    public function __construct(protected BotPageCache $cache)
    {
    }

    public function subscribe(Dispatcher $events): void
    {
        foreach ([
            PostEvent\Posted::class, PostEvent\Revised::class, PostEvent\Hidden::class, PostEvent\Restored::class, PostEvent\Deleted::class,
            DiscussionEvent\Started::class, DiscussionEvent\Renamed::class, DiscussionEvent\Hidden::class,
            DiscussionEvent\Restored::class, DiscussionEvent\Deleted::class,
        ] as $event) {
            if (class_exists($event)) {
                $events->listen($event, [$this, 'flush']);
            }
        }
    }

    public function flush(): void
    {
        if ($this->cache->enabled()) {
            $this->cache->flush();
        }
    }
}
