<?php

use Flarum\Extend;
use Framio\CustomHomepage\Api\Controller\GalleryPostsController;
use Framio\CustomHomepage\Api\Controller\FlushCacheController;
use Framio\CustomHomepage\Support\GalleryPosts;

$flushGallery = fn () => resolve(GalleryPosts::class)->flush();

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/less/forum.less')
        ->route('/gallery', 'spotters.gallery'),

    (new Extend\Middleware('forum'))
        ->add(Framio\CustomHomepage\Middleware\LightboxRedirectMiddleware::class),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/less/admin.less'),

    (new Extend\Routes('api'))
        ->get('/framio/homepage-posts', 'framio.homepage-posts', GalleryPostsController::class)
        ->get('/framio/category-posts', 'framio.category-posts', GalleryPostsController::class)
        ->post('/framio/homepage-cache/flush', 'framio.homepage-cache.flush', FlushCacheController::class),

    (new Extend\Settings())
        // Genel & Metinler (boşsa forum başlığı / varsayılan metin kullanılır)
        // Menü yöneticisi: öğe sırası, adları, ikonları, görünürlüğü (yatay / dikey)
        ->serializeToForum('framioNavMenu', 'framio-custom-homepage.nav_menu', 'strval', '[]')
        // Forumda bulunan menü öğeleri (yönetici ziyaretinde kaydedilir; admin listesi için)
        ->serializeToForum('framioNavNewDiscussion', 'framio-custom-homepage.nav_new_discussion', 'strval', '{}')
        ->serializeToForum('framioPageHeroes', 'framio-custom-homepage.page_heroes', 'strval', '{}')
        ->serializeToForum('framioNavHeader', 'framio-custom-homepage.nav_header', 'strval', '{}')
        ->serializeToForum('framioNavDiscovered', 'framio-custom-homepage.nav_discovered', 'strval', '[]')
        ->serializeToForum('framioHomeSiteLabel', 'framio-custom-homepage.site_label', 'strval', '')
        ->serializeToForum('framioHomeLoadingText', 'framio-custom-homepage.loading_text', 'strval', '')
        ->serializeToForum('framioHomeEmptyText', 'framio-custom-homepage.empty_text', 'strval', '')
        ->serializeToForum('framioHomeShareText', 'framio-custom-homepage.share_text', 'strval', '')
        ->default('framio-custom-homepage.gallery_post_limit', '60')
        ->default('framio-custom-homepage.cache_minutes', '5')
        ->serializeToForum('framioCustomHomepageClickBehavior', 'framio-custom-homepage.click_behavior', 'strval', 'lightbox')
        ->serializeToForum('framioCustomHomepageGalleryMode', 'framio-custom-homepage.gallery_mode', 'strval', 'recent')
        ->serializeToForum('framioCustomHomepageCurated', 'framio-custom-homepage.curated_images', 'strval', '[]')
        ->serializeToForum('framioCustomHomepageCoverOverrides', 'framio-custom-homepage.cover_overrides', 'strval', '[]')
        
        ->serializeToForum('framioSliderActive', 'framio-custom-homepage.slider_active', 'strval', '1')
        ->serializeToForum('framioSliderLayoutMode', 'framio-custom-homepage.slider_layout_mode', 'strval', 'grid-8')
        
        ->serializeToForum('framioGalleryActive', 'framio-custom-homepage.gallery_active', 'strval', '1')
        ->serializeToForum('framioCoversActive', 'framio-custom-homepage.covers_active', 'strval', '1')
        
        ->serializeToForum('framioCategoryGalleryActive', 'framio-custom-homepage.category_gallery_active', 'strval', '1')
        ->serializeToForum('framioCategoryGalleryLayout', 'framio-custom-homepage.category_gallery_layout', 'strval', '3')
        
        ->serializeToForum('framioPrimaryGalleryActive', 'framio-custom-homepage.primary_gallery_active', 'strval', '1')
        ->serializeToForum('framioPrimaryDefaultSort', 'framio-custom-homepage.primary_default_sort', 'strval', 'gallery')
        ->serializeToForum('framioPrimaryOtherTabsActive', 'framio-custom-homepage.primary_other_tabs_active', 'strval', '1')
        ->serializeToForum('framioPrimaryGalleryPosition', 'framio-custom-homepage.primary_gallery_position', 'strval', 'top')
        
        ->serializeToForum('framioSecondaryGalleryActive', 'framio-custom-homepage.secondary_gallery_active', 'strval', '1')
        ->serializeToForum('framioSecondaryDefaultSort', 'framio-custom-homepage.secondary_default_sort', 'strval', 'gallery')
        ->serializeToForum('framioSecondaryOtherTabsActive', 'framio-custom-homepage.secondary_other_tabs_active', 'strval', '1')
        ->serializeToForum('framioSecondaryGalleryPosition', 'framio-custom-homepage.secondary_gallery_position', 'strval', 'top')
        
        ->serializeToForum('framioTagGalleryOverrides', 'framio-custom-homepage.tag_gallery_overrides', 'strval', '{}')
        
        ->serializeToForum('framioSliderData', 'framio-custom-homepage.slider_data', 'strval', '[]')
        ->serializeToForum('framioSliderHeight', 'framio-custom-homepage.slider_height', 'strval', '450px')
        ->serializeToForum('framioSliderWidth', 'framio-custom-homepage.slider_width', 'strval', '100%')
        
        ->serializeToForum('framioTagLayoutMode', 'framio-custom-homepage.tag_layout_mode', 'strval', 'default')
        ->serializeToForum('framioTagCardStyle', 'framio-custom-homepage.tag_card_style', 'strval', 'image')
        ->serializeToForum('framioTagCarouselWidth', 'framio-custom-homepage.tag_carousel_width', 'strval', 'calc((100% - 40px) / 3)')
        ->serializeToForum('framioTagCarouselHeight', 'framio-custom-homepage.tag_carousel_height', 'strval', '250px')
        ->serializeToForum('framioTagCovers', 'framio-custom-homepage.tag_covers', 'strval', '{}')
        
        ->serializeToForum('framioFeedRefreshBehavior', 'framio-custom-homepage.feed_refresh_behavior', 'strval', 'B'),

    // Galeri önbelleği içerik değişince temizlenir
    (new Extend\Event())
        ->listen(\Flarum\Post\Event\Posted::class, $flushGallery)
        ->listen(\Flarum\Post\Event\Hidden::class, $flushGallery)
        ->listen(\Flarum\Post\Event\Restored::class, $flushGallery)
        ->listen(\Flarum\Post\Event\Deleted::class, $flushGallery)
        ->listen(\Flarum\Post\Event\Revised::class, $flushGallery)
        ->listen(\Flarum\Discussion\Event\Hidden::class, $flushGallery)
        ->listen(\Flarum\Discussion\Event\Deleted::class, $flushGallery),
];
