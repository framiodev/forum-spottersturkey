<?php

namespace Framio\SeoPack\Listener;

use Flarum\Post\Event\Deleted;
use Flarum\Post\Event\Hidden;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Restored;
use Flarum\Post\Event\Revised;
use Framio\SeoPack\Support\EntityIndex;
use Illuminate\Contracts\Events\Dispatcher;

/** Künye dizinini mesaj olaylarıyla güncel tutar. */
class UpdateEntityIndex
{
    public function __construct(protected EntityIndex $index)
    {
    }

    public function subscribe(Dispatcher $events): void
    {
        $events->listen([Posted::class, Revised::class, Restored::class], function ($event) {
            $this->safely(fn () => $this->index->index($event->post));
        });
        $events->listen([Hidden::class, Deleted::class], function ($event) {
            $this->safely(fn () => $this->index->remove((int) $event->post->id));
        });
    }

    private function safely(callable $fn): void
    {
        try {
            $fn();
        } catch (\Throwable $e) {
            // Dizin güncellemesi mesaj kaydını asla engellememeli
        }
    }
}
