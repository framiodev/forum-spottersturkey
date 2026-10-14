<?php

namespace Framio\SeoPack\Listener;

use Carbon\Carbon;
use Flarum\Discussion\Event\Started;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Revised;
use Framio\SeoPack\Support\SeoSettings;
use Google\Client;
use Google\Service\Indexing;

/**
 * Google Indexing API bildirimi. Varsayılan olarak kapalıdır (Google bu
 * API'yi resmî olarak yalnızca iş ilanı / canlı yayın sayfaları için
 * destekler); admin panelinden bilerek açılmalıdır.
 */
class SendToGoogleConsole
{
    public function __construct(protected SeoSettings $seo)
    {
    }

    public function whenDiscussionStarted(Started $event): void
    {
        $d = $event->discussion;
        if ($this->send($this->seo->discussionUrl($d))) {
            $d->seo_last_sent_at = Carbon::now();
            $d->saveQuietly();
        }
    }

    public function whenPostCreated(Posted $event): void
    {
        $post = $event->post;
        if ($post->number == 1 || !$post->discussion || $post->is_private) {
            return;
        }

        $this->markSent($post, $this->send($this->seo->discussionUrl($post->discussion, (int) $post->number)));
    }

    public function whenPostRevised(Revised $event): void
    {
        $post = $event->post;
        if (!$post->discussion || $post->is_private) {
            return;
        }

        $this->markSent($post, $this->send($this->seo->discussionUrl($post->discussion, (int) $post->number)));
    }

    private function markSent($post, bool $sent): void
    {
        if (!$sent) {
            return;
        }

        $now = Carbon::now();
        $post->seo_last_sent_at = $now;
        $post->saveQuietly();
        $post->discussion->seo_last_sent_at = $now;
        $post->discussion->saveQuietly();
    }

    private function send(string $url): bool
    {
        if (!$this->seo->bool('enable_indexing_api')) {
            return false;
        }

        $keyFile = storage_path('service_account.json');
        if (!file_exists($keyFile)) {
            return false;
        }

        try {
            $client = new Client();
            $client->setAuthConfig($keyFile);
            $client->addScope('https://www.googleapis.com/auth/indexing');

            $notification = new Indexing\UrlNotification();
            $notification->setUrl($url);
            $notification->setType('URL_UPDATED');
            (new Indexing($client))->urlNotifications->publish($notification);

            return true;
        } catch (\Throwable $e) {
            @file_put_contents(storage_path('logs/seo-indexing.log'), '[' . date('Y-m-d H:i:s') . '] Error for ' . $url . ': ' . $e->getMessage() . PHP_EOL, FILE_APPEND);

            return false;
        }
    }
}
