<?php

/*
 * framio/community — notifications/PostPostedListener
 *
 * Yeni konu ve yanıtları grup yayını kuyruğuna ekler. Gönderim mesaj kaydını
 * beklemez: Broadcaster yanıt kullanıcıya döndükten sonra gönderir.
 */

namespace Framio\Community\Notifications\Listener;

use Flarum\Post\CommentPost;
use Flarum\Post\Event\Posted;
use Framio\Community\Notifications\Broadcast\Broadcaster;

class PostPostedListener
{
    public function __construct(protected Broadcaster $broadcaster)
    {
    }

    public function handle(Posted $event): void
    {
        if ($event->post instanceof CommentPost) {
            try {
                $this->broadcaster->enqueue($event->post);
            } catch (\Throwable $e) {
                // Yayın hatası mesaj göndermeyi asla engellemesin
                resolve('log')->warning('[broadcast] kuyruk: ' . $e->getMessage());
            }
        }
    }
}
