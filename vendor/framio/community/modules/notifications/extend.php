<?php

/*
 * framio/community — notifications modülü
 * Forum mesajlarını Telegram ve WhatsApp gruplarına duyurur (kuyruk + toplu gönderim).
 */

use Flarum\Post\Event\Posted;
use Flarum\Extend;
use Framio\Community\Notifications\Broadcast\BroadcastController;
use Framio\Community\Notifications\Listener\PostPostedListener;

return [
    // Yeni konunun ilk mesajı da Posted olayıyla gelir; ayrı "Started" dinleyicisi gerekmez
    (new Extend\Event())
        ->listen(Posted::class, PostPostedListener::class),

    (new Extend\Routes('api'))
        ->get('/framio-broadcast', 'framio.broadcast.state', BroadcastController::class)
        ->post('/framio-broadcast', 'framio.broadcast.action', BroadcastController::class),

    new Extend\Locales(__DIR__ . '/locale'),
];
