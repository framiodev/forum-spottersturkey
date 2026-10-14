<?php

/**
 * Framio Enterprise SEO Suite - Ana Yapılandırma Dosyası
 */

namespace Framio\SeoPack;

use Flarum\Extend;

// Kontrolcüler
use Framio\SeoPack\InjectSeoTags;
use Framio\SeoPack\SitemapController;
use Framio\SeoPack\BatchIndexController;
use Framio\SeoPack\InspectController;
use Framio\SeoPack\ContentListController;
use Framio\SeoPack\DashboardStatsController;
use Framio\SeoPack\WebAutoIndexController;
use Framio\SeoPack\ImageIndexController;
use Framio\SeoPack\PostAuditController;
use Framio\SeoPack\ImageSitemapController;
use Framio\SeoPack\OrphanImageController;
use Framio\SeoPack\ApiLogController;
use Framio\SeoPack\ManualIndexController;
use Framio\SeoPack\ManualPingController;
use Framio\SeoPack\FixAltTagsController;
use Framio\SeoPack\GoogleAuthController;
use Framio\SeoPack\GoogleCallbackController;
use Framio\SeoPack\GoogleLogoutController;
use Framio\SeoPack\IndexNowKeyController;
use Framio\SeoPack\OgImageController;
use Framio\SeoPack\RobotsController;
use Framio\SeoPack\PostSitemapController;
use Framio\SeoPack\Api\Controller\ManageAdsController;
use Framio\SeoPack\Api\Controller\SearchAnalyticsController;
use Framio\SeoPack\Api\Controller\SocialHubController;
use Framio\SeoPack\Api\Controller\RedirectsController;
use Framio\SeoPack\Middleware\LegacyRedirects;

// Konsol Komutları
use Framio\SeoPack\Console\AutoIndexCommand;
use Framio\SeoPack\Console\FixOldAltTagsCommand;

// Dinleyiciler
use Framio\SeoPack\Listener\SendToGoogleConsole;
use Framio\SeoPack\Listener\PingIndexNow;
use Framio\SeoPack\Listener\AutoAltTags;

// Flarum Olayları
use Flarum\Discussion\Event\Started;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Revised;

return [
    (new Extend\Locales(__DIR__.'/resources/locale')),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/resources/less/admin.less'),

    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/resources/less/forum.less'),

    (new Extend\Routes('forum'))
        ->get('/sitemap.xml', 'framio.seo.sitemap', SitemapController::class)
        ->get('/sitemap_index.xml', 'framio.seo.sitemap.alt', SitemapController::class)
        ->get('/sitemap-images.xml', 'framio.seo.sitemap.images', ImageSitemapController::class)
        ->get('/robots.txt', 'framio.seo.robots', RobotsController::class)
        ->get('/ads.txt', 'framio.seo.adstxt', \Framio\SeoPack\AdsTxtController::class)
        ->get('/sitemap-posts.xml', 'framio.seo.sitemap.posts', PostSitemapController::class)
        ->get('/sitemap-hubs.xml', 'framio.seo.sitemap.hubs', \Framio\SeoPack\HubSitemapController::class)
        ->get('/{key:[A-Za-z0-9-]{8,128}}.txt', 'framio.seo.indexnow.key', IndexNowKeyController::class),

    (new Extend\Routes('api'))
        ->get('/seo/batch', 'framio.seo.batch.index', BatchIndexController::class)
        ->get('/seo/inspect', 'framio.seo.inspect', InspectController::class)
        ->get('/seo/content', 'framio.seo.content', ContentListController::class)
        ->get('/seo/stats', 'framio.seo.dashboard.stats', DashboardStatsController::class)
        ->get('/seo/images', 'framio.seo.images.index', ImageIndexController::class)
        ->get('/seo/post-audit', 'framio.seo.post.audit', PostAuditController::class)
        ->get('/seo/orphan-images', 'framio.seo.orphan.images', OrphanImageController::class)
        ->post('/seo/orphan-images', 'framio.seo.orphan.images.action', OrphanImageController::class)
        ->get('/seo/logs', 'framio.seo.logs', ApiLogController::class)
        ->get('/seo/trigger-index', 'framio.seo.trigger.index', WebAutoIndexController::class)
        ->post('/seo/manual-index', 'framio.seo.manual.index', ManualIndexController::class)
        ->post('/seo/manual-ping', 'framio.seo.manual.ping', ManualPingController::class)
        ->post('/seo/fix-alt-tags', 'framio.seo.fix.alt.tags', FixAltTagsController::class)
        ->get('/seo/google-login', 'framio.seo.google.login', GoogleAuthController::class)
        ->get('/seo/google-callback', 'framio.seo.google.callback', GoogleCallbackController::class)
        ->post('/seo/google-logout', 'framio.seo.google.logout', GoogleLogoutController::class)
        ->get('/seo/ads', 'framio.seo.ads.get', ManageAdsController::class)
        ->post('/seo/ads', 'framio.seo.ads.post', ManageAdsController::class)
        ->get('/seo/searches', 'framio.seo.searches.get', SearchAnalyticsController::class)
        ->post('/seo/searches', 'framio.seo.searches.post', SearchAnalyticsController::class)
        ->get('/seo/social-hub', 'framio.seo.social.get', SocialHubController::class)
        ->get('/seo/og-image/{id}', 'framio.seo.og.image', OgImageController::class)
        ->get('/seo/redirects', 'framio.seo.redirects.get', RedirectsController::class)
        ->post('/seo/redirects', 'framio.seo.redirects.post', RedirectsController::class)
        ->get('/seo/health', 'framio.seo.health', \Framio\SeoPack\Api\Controller\SeoHealthController::class)
        ->post('/seo/health', 'framio.seo.health.post', \Framio\SeoPack\Api\Controller\SeoHealthController::class)
        ->get('/seo/search-appearance', 'framio.seo.search.appearance', \Framio\SeoPack\Api\Controller\SearchAppearanceController::class)
        ->get('/seo/hubs','framio.seo.hubs', \Framio\SeoPack\Api\Controller\HubController::class),

    // Marka / model / firma / plaka derleme sayfaları: Flarum frontend rotası
    // (SPA aynı adreste HubPage bileşeniyle açılır; sunucu tarafı SEO içeriği HubContent)
    (new Extend\Frontend('forum'))
        ->route('/arac', 'framio-seo.hubs', \Framio\SeoPack\HubContent::class)
        ->route('/arac/{type:marka|model|firma|plaka|sehir|yil|yer}/{slug}', 'framio-seo.hub', \Framio\SeoPack\HubContent::class),

    // Eski adres yönlendirmeleri + 404 kaydı (hata yakalayıcının dışında çalışmalı)
    (new Extend\Middleware('forum'))
        ->insertBefore('flarum.forum.error_handler', LegacyRedirects::class),

    (new Extend\Frontend('forum'))
        // Negatif öncelik: çekirdek ve diğer eklentilerin içeriğinden SONRA çalışır
        // Sayfa başlıkları Flarum'un varsayılan ayarına bırakılır (forum adı)
        ->content(InjectSeoTags::class, -100)
        // İç sayfalarda kısa başlık soneki (admin: Arama Görünümü); ayar boşsa çekirdekle aynı
        ->title(\Framio\SeoPack\Support\SeoTitleDriver::class),

    (new Extend\Event())
        ->listen(Started::class, function (Started $event) {
            resolve(SendToGoogleConsole::class)->whenDiscussionStarted($event);
            resolve(PingIndexNow::class)->whenDiscussionStarted($event);
        })
        ->listen(Posted::class, function (Posted $event) {
            resolve(SendToGoogleConsole::class)->whenPostCreated($event);
            resolve(PingIndexNow::class)->whenPostCreated($event);
            resolve(AutoAltTags::class)->whenPostCreated($event);
        })
        ->listen(Revised::class, function (Revised $event) {
            resolve(SendToGoogleConsole::class)->whenPostRevised($event);
            resolve(PingIndexNow::class)->whenPostRevised($event);
            resolve(AutoAltTags::class)->whenPostRevised($event);
        })
        ->subscribe(\Framio\SeoPack\Listener\UpdateEntityIndex::class)
        ->subscribe(\Framio\SeoPack\BotCache\FlushBotCache::class),

    // Arama motoru botları için sayfa önbelleği (oturum başlamadan önce; insan ziyaretçiler etkilenmez)
    (new Extend\Middleware('forum'))
        // insertBefore aynı hedef için tek kayıt tutar; bu yüzden iki ara katman farklı noktalara eklenir
        ->insertBefore(\Flarum\Http\Middleware\CollectGarbage::class, \Framio\SeoPack\Redirect\LegacyUrlRedirect::class)
        ->insertBefore(\Flarum\Http\Middleware\StartSession::class, \Framio\SeoPack\BotCache\BotCacheMiddleware::class),

    // Künye kelimelerini SPA'da derleme sayfalarına bağlamak için mesaj API alanı
    (new Extend\ApiResource(\Flarum\Api\Resource\PostResource::class))
        ->fields(fn () => [
            \Flarum\Api\Schema\Arr::make('seoEntities')
                ->get(fn ($post) => $post->type === 'comment' ? resolve(\Framio\SeoPack\Support\EntityIndex::class)->forPost((int) $post->id) : []),
        ]),

    // Reklam: forum tarafının ihtiyaç duyduğu genel ayarlar
    (new Extend\Settings())
        ->serializeToForum('framioAdsEnabled', 'framio-seo.ads_enabled', 'boolval', false)
        ->serializeToForum('framioAdsClient', 'framio-seo.ads_client')
        ->serializeToForum('framioAdsAuto', 'framio-seo.ads_auto_ads', 'boolval', false)
        ->serializeToForum('framioAdsHideMembers', 'framio-seo.ads_hide_members', 'boolval', false)
        ->serializeToForum('framioAdsLabel', 'framio-seo.ads_label', null, 'Reklam'),

    (new Extend\Console())
        ->command(AutoIndexCommand::class)
        ->command(\Framio\SeoPack\Console\BackfillIndexCommand::class)
        ->command(FixOldAltTagsCommand::class)
        ->command(\Framio\SeoPack\Console\IndexEntitiesCommand::class),
];