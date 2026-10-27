<?php

namespace Framio\SeoPack\Listener;

use Flarum\Post\Event\Posted;
use Framio\SeoPack\FeedController;
use Framio\SeoPack\Support\PostPages;
use Framio\SeoPack\Support\SeoSettings;
use GuzzleHttp\Client;
use Throwable;

/**
 * Yeni fotoğraflı/künyeli paylaşımda WebSub merkezine "akış güncellendi" bildirimi (yalnızca akışın adresi gider).
 * Google akışa abone olduğu için yeni mesaj sayfasını site haritasını beklemeden öğrenir.
 */
class PingWebSub
{
    public function __construct(protected SeoSettings $seo, protected PostPages $pages)
    {
    }

    public function whenPostCreated(Posted $event): void
    {
        if (!$this->seo->bool('enable_websub') || !$this->pages->qualifies($event->post)) return;
        try {
            (new Client(['timeout' => 3, 'connect_timeout' => 2]))->post(FeedController::HUB, [
                'form_params' => ['hub.mode' => 'publish', 'hub.url' => $this->seo->baseUrl() . '/feed.xml'],
            ]);
        } catch (Throwable $e) {
            // Bildirim gitmese de akış ve site haritası yerinde; sonraki paylaşımda yeniden denenir
        }
    }
}
