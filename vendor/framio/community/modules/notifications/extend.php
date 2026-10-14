<?php

/*
 * framio/community — notifications modülü
 * Telegram ve WhatsApp grup bildirimleri.
 */

use Flarum\Discussion\Event\Started;
use Flarum\Post\Event\Posted;
use Flarum\Extend;
use Framio\Community\Notifications\Listener\DiscussionStartedListener;
use Framio\Community\Notifications\Listener\PostPostedListener;

return [
    (new Extend\Event())
        ->listen(Started::class, DiscussionStartedListener::class)
        ->listen(Posted::class, PostPostedListener::class),

    new Extend\Locales(__DIR__ . '/locale'),
];
