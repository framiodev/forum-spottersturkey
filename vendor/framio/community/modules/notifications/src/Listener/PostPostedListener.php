<?php

/*
 * framio/community — notifications/PostPostedListener
 *
 * Yanıt gönderildiğinde Telegram ve WhatsApp bildirimini tetikler.
 * Tartışmanın ilk postu (firstPost) atlanır — yeni konu bildirimiyle çakışmasın.
 */

namespace Framio\Community\Notifications\Listener;

use Flarum\Post\Event\Posted;
use Flarum\Http\UrlGenerator;
use Framio\Community\Notifications\NotificationService;

class PostPostedListener
{
    protected NotificationService $notifier;
    protected UrlGenerator $url;

    public function __construct(NotificationService $notifier, UrlGenerator $url)
    {
        $this->notifier = $notifier;
        $this->url      = $url;
    }

    public function handle(Posted $event): void
    {
        $post       = $event->post;
        $actor      = $event->actor;
        $discussion = $post->discussion;

        // İlk post'u atla (tartışma oluşturulurken zaten DiscussionStartedListener çalışır)
        if ($post->number === 1) {
            return;
        }

        // Sadece "comment" tipindeki postları işle
        if ($post->type !== 'comment') {
            return;
        }

        // Post excerpt
        $content = $post->content ?? '';
        $excerpt = mb_substr(strip_tags($content), 0, 200);
        if (mb_strlen($excerpt) === 200) {
            $excerpt .= '...';
        }

        $postUrl = $this->url->to('forum')->route('discussion', [
            'id' => $discussion->id . '-' . $discussion->slug,
        ]) . '/' . $post->number;

        $this->notifier->send('reply', [
            'title'   => $discussion->title ?? '',
            'author'  => $actor->display_name ?? $actor->username ?? '',
            'url'     => $postUrl,
            'excerpt' => $excerpt,
        ]);
    }
}
