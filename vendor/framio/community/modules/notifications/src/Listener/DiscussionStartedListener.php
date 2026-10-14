<?php

/*
 * framio/community — notifications/DiscussionStartedListener
 *
 * Yeni tartışma açıldığında Telegram ve WhatsApp bildirimini tetikler.
 */

namespace Framio\Community\Notifications\Listener;

use Flarum\Discussion\Event\Started;
use Flarum\Http\UrlGenerator;
use Framio\Community\Notifications\NotificationService;
use Illuminate\Contracts\Container\Container;

class DiscussionStartedListener
{
    protected NotificationService $notifier;
    protected UrlGenerator $url;

    public function __construct(NotificationService $notifier, UrlGenerator $url)
    {
        $this->notifier = $notifier;
        $this->url      = $url;
    }

    public function handle(Started $event): void
    {
        $discussion = $event->discussion;
        $actor      = $event->actor;

        // Tartışmanın ilk postunu al (excerpt için)
        $firstPost = $discussion->firstPost;
        $excerpt   = '';
        if ($firstPost) {
            $content = $firstPost->content ?? '';
            // Düz metin, en fazla 200 karakter
            $excerpt = mb_substr(strip_tags($content), 0, 200);
            if (mb_strlen($excerpt) === 200) {
                $excerpt .= '...';
            }
        }

        $discussionUrl = $this->url->to('forum')->route('discussion', [
            'id' => $discussion->id . '-' . $discussion->slug,
        ]);

        $this->notifier->send('discussion', [
            'title'   => $discussion->title ?? '',
            'author'  => $actor->display_name ?? $actor->username ?? '',
            'url'     => $discussionUrl,
            'excerpt' => $excerpt,
        ]);
    }
}
