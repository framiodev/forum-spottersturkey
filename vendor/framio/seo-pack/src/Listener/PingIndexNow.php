<?php

namespace Framio\SeoPack\Listener;

use Flarum\Discussion\Event\Started;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Revised;
use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;

class PingIndexNow
{
    protected UrlGenerator $url;
    protected SettingsRepositoryInterface $settings;

    public function __construct(UrlGenerator $url, SettingsRepositoryInterface $settings)
    {
        $this->url = $url;
        $this->settings = $settings;
    }

    public function whenDiscussionStarted(Started $event)
    {
        $this->pingDiscussion($event->discussion);
    }

    public function whenPostCreated(Posted $event)
    {
        if ($event->post->number > 1 && !$event->post->is_private) {
            $this->pingDiscussion($event->post->discussion, (int) $event->post->number);
        }
    }

    public function whenPostRevised(Revised $event)
    {
        if (!$event->post->is_private) {
            $this->pingDiscussion($event->post->discussion, (int) $event->post->number);
        }
    }

    private function pingDiscussion($discussion, int $postNumber = 1): void
    {
        $seo = resolve(\Framio\SeoPack\Support\SeoSettings::class);

        // Gizli/özel içerik arama motorlarına bildirilmez
        if (!$discussion || $discussion->is_private || $discussion->hidden_at || !$seo->bool('enable_indexnow')) {
            return;
        }

        // Künyeli / fotoğraflı mesaj kendi kalıcı adresiyle, diğerleri tartışma sayfasıyla bildirilir
        $pages = resolve(\Framio\SeoPack\Support\PostPages::class);
        $post = $postNumber > 1 ? $discussion->posts()->where('number', $postNumber)->first() : null;
        $this->ping(($post && $pages->qualifies($post)) ? $pages->url($post) : $seo->discussionUrl($discussion, $postNumber));
    }

    protected function ping(string $pageUrl): void
    {
        $key = $this->getOrCreateKey();
        $host = parse_url($pageUrl, PHP_URL_HOST);

        $path = '/indexnow'
            . '?url=' . urlencode($pageUrl)
            . '&key=' . urlencode($key)
            . '&keyLocation=' . urlencode(rtrim($this->url->to('forum')->base(), '/') . '/' . $key . '.txt');

        try {
            $sock = @stream_socket_client(
                'ssl://api.indexnow.org:443',
                $errno,
                $errstr,
                2,
                STREAM_CLIENT_CONNECT
            );

            if ($sock === false) {
                return;
            }

            stream_set_timeout($sock, 1);

            $request = "GET {$path} HTTP/1.1\r\n"
                . "Host: api.indexnow.org\r\n"
                . "Connection: Close\r\n\r\n";

            @fwrite($sock, $request);
            @fclose($sock);
        } catch (\Throwable $e) {}
    }

    protected function getOrCreateKey(): string
    {
        $key = $this->settings->get('framio-seo.indexnow_key');

        if (!$key) {
            $key = bin2hex(random_bytes(16));
            $this->settings->set('framio-seo.indexnow_key', $key);
        }

        return $key;
    }
}
