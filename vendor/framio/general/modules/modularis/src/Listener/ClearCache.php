<?php

namespace Stezkoy\FlarumModularis\Listener;

use Flarum\Foundation\Event\ClearingCache;
use Stezkoy\FlarumModularis\CacheRebuilder;
use Stezkoy\FlarumModularis\Event\StyleCreated;
use Stezkoy\FlarumModularis\Event\StyleDeleted;
use Stezkoy\FlarumModularis\Event\StyleUpdated;
use Illuminate\Contracts\Events\Dispatcher;

class ClearCache
{
    public function __construct(private readonly CacheRebuilder $rebuilder)
    {
    }

    public function subscribe(Dispatcher $events): void
    {
        // After a style is saved/deleted, invalidate and immediately rebuild
        // so the next request hits a warm cache.
        $events->listen(
            [StyleCreated::class, StyleUpdated::class, StyleDeleted::class],
            [$this, 'invalidateAndRebuild']
        );

        // On a full cache:clear, only invalidate — don't rebuild. The first
        // request will trigger a cold-miss rebuild automatically.
        $events->listen(ClearingCache::class, [$this, 'invalidateOnly']);
    }

    public function invalidateAndRebuild(): void
    {
        $this->rebuilder->invalidate();
        $this->rebuilder->rebuild();
    }

    public function invalidateOnly(): void
    {
        $this->rebuilder->invalidate();
    }
}
