<?php

/*
 * framio/community — notifications modülü
 * Forum mesajlarını Telegram ve WhatsApp gruplarına duyurur (kuyruk + toplu gönderim).
 */

use Flarum\Post\Event\Posted;
use Flarum\Extend;
use Framio\Community\Notifications\Broadcast\BroadcastController;
use Framio\Community\Notifications\Broadcast\HighlightBlueprint;
use Framio\Community\Notifications\Listener\PostPostedListener;

return [
    // Yeni konunun ilk mesajı da Posted olayıyla gelir; ayrı "Started" dinleyicisi gerekmez
    (new Extend\Event())
        ->listen(Posted::class, PostPostedListener::class),

    (new Extend\Routes('api'))
        ->get('/framio-broadcast', 'framio.broadcast.state', BroadcastController::class)
        ->post('/framio-broadcast', 'framio.broadcast.action', BroadcastController::class),

    // Grup duyurusunun üyelere giden site bildirimi. Varsayılan: site içi bildirim açık;
    // tarayıcı (PWA push) ve e-posta üyenin bildirim ayarlarından açılır.
    (new Extend\Notification())
        ->type(HighlightBlueprint::class, ['alert']),

    (new Extend\View())
        ->namespace('framio-broadcast', __DIR__ . '/resources/views'),

    (new Extend\Settings())
        ->default('notifications.site_notify', '1'),

    new Extend\Locales(__DIR__ . '/locale'),
];
