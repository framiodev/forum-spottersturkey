<?php

/*
 * Framio Forum İstatistikleri (FoF forum-statistics-widget temelli, yeniden yazıldı).
 */

namespace Framio\Widgets\ForumStatisticsWidget;

use Flarum\Api\Resource;
use Flarum\Api\Schema;
use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/resources/less/forum.less')
        // Ayrıntılı istatistik sayfası (izin: framio-stats.viewPage)
        ->route('/istatistikler', 'framio.stats'),

    (new Extend\Frontend('admin'))
        ->css(__DIR__.'/resources/less/admin.less'),

    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\Routes('api'))
        ->get('/framio-stats', 'framio-stats.show', Api\StatsController::class)
        ->post('/framio-stats/refresh', 'framio-stats.refresh', Api\StatsController::class)
        ->get('/framio-stats/detail', 'framio-stats.detail', Api\DetailController::class)
        // Mesaj görüntülenmeleri ve kimlerin görüntülediği
        ->post('/framio-views', 'framio-views.record', Views\ViewsController::class)
        ->get('/framio-views/{kind:post|discussion}/{id:\d+}', 'framio-views.viewers', Views\ViewsController::class),

    (new Extend\Settings())
        // Sayım kuralları
        ->default('framio-stats.exclude_hidden', '1')
        ->default('framio-stats.exclude_private', '1')
        ->default('framio-stats.exclude_unconfirmed', '1')
        ->default('framio-stats.exclude_suspended', '0')
        // Önbellek ve kaynaklar
        ->default('framio-stats.cache_duration', '600')
        ->default('framio-stats.online_minutes', '5')
        ->default('framio-stats.photo_table', 'framio_media_images')
        // Görünüm: istatistik listesi, düzen, renk, yerleşim (JSON)
        ->serializeToForum('framioStatsConfig', 'framio-stats.config', 'strval', '{}'),

    (new Extend\ApiResource(Resource\ForumResource::class))
        ->fields(AddForumStats::class),

    (new Extend\Event())
        ->subscribe(Listener\FlushStats::class)
        // Tartışma görüntülenmesi: engagement paketindeki discussion-views modülünün olayı
        ->listen(\Framio\Engagement\DiscussionViews\Events\DiscussionWasViewed::class, function ($event) {
            resolve(Views\ViewRecorder::class)->recordDiscussion($event->discussion, $event->actor, $event->ip, $event->userAgent);
        }),

    // Mesajın görüntülenme sayısı (izin: framio-stats.viewPostViews)
    (new Extend\ApiResource(Resource\PostResource::class))
        ->fields(fn () => [
            Schema\Integer::make('framioViews')
                ->nullable()
                ->visible(fn ($post, $context) => $context->getActor()->hasPermission('framio-stats.viewPostViews'))
                ->get(fn ($post) => (int) (resolve(\Illuminate\Database\ConnectionInterface::class)->table('framio_post_views')->where('post_id', $post->id)->value('views') ?? 0)),
        ]),

    (new Extend\ApiResource(Resource\ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('framioCanViewStatsPage')->get(fn ($m, $context) => $context->getActor()->hasPermission('framio-stats.viewPage')),
            Schema\Boolean::make('framioCanViewViewers')->get(fn ($m, $context) => $context->getActor()->hasPermission('framio-stats.viewViewers')),
            Schema\Boolean::make('framioCanViewPostViews')->get(fn ($m, $context) => $context->getActor()->hasPermission('framio-stats.viewPostViews')),
        ]),
];
