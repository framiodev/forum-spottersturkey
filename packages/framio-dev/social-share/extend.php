<?php

namespace Framio\SocialShare;

use Flarum\Extend;
use Framio\SocialShare\Api\Controller\SharePostController;
use Framio\SocialShare\Api\Controller\TriggerScheduleController;
use Framio\SocialShare\Api\Controller\ListQueueController;
use Framio\SocialShare\Api\Controller\UpdateQueueController;

$extenders = [
    // Forum (Ön Yüz)
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/less/forum.less'),

    // Admin Paneli
    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js'),

    // API Rotaları
    (new Extend\Routes('api'))
        // 1. Paylaşım (Forum Modalı)
        ->post('/framio/social-share', 'framio.social-share.post', SharePostController::class)
        
        // 2. Cron Tetikleyici (Sunucu)
        ->get('/framio/social-share/trigger-cron', 'framio.social-share.trigger-cron', TriggerScheduleController::class)

        // 3. Admin Kuyruk Listesi
        ->get('/framio/social-share/queue', 'framio.social-share.list', ListQueueController::class)

        // 4. Admin Kuyruk Güncelleme/Silme
        ->post('/framio/social-share/queue/update', 'framio.social-share.update', UpdateQueueController::class)

        // 5. Admin Hikaye Arka Planı / Video Yükleme
        ->post('/framio/social-share/upload-bg', 'framio.social-share.upload-bg', Api\Controller\UploadStoryBackgroundController::class)

        // 6. Admin Token Sağlık ve Süre Kontrolü
        ->post('/framio/social-share/check-token', 'framio.social-share.check-token', Api\Controller\CheckTokenHealthController::class)

        // 7. Yapay Zeka (AI) Metin Üretici
        ->post('/framio/social-share/ai-generate', 'framio.social-share.ai-generate', Api\Controller\GenerateAiCaptionController::class)

        // 8. Cihazdan İmzalı 4K Görsel Yükleyici (Geçici / Ephemeral)
        ->post('/framio/social-share/upload-watermarked', 'framio.social-share.upload-watermarked', Api\Controller\UploadWatermarkedController::class)

        // 9. Forum Arşivinden Kolay Görsel Seçici
        ->get('/framio/social-share/recent-images', 'framio.social-share.recent-images', Api\Controller\RecentForumImagesController::class)

        // 10. Forum Akışı Gönderi ve Görsel Seçici
        ->get('/framio/social-share/forum-feed-posts', 'framio.social-share.forum-feed-posts', Api\Controller\ForumFeedPostsController::class)

        // 11. CORS Güvenli Görsel Proxy (Canvas ve Önizleme İçin)
        ->get('/framio/social-share/proxy-image', 'framio.social-share.proxy-image', Api\Controller\ProxyImageController::class)

        // 12. Canva OAuth 2.0 PKCE Kimlik Doğrulama
        ->get('/framio/social-share/canva/auth', 'framio.social-share.canva.auth', Api\Controller\CanvaAuthController::class)
        ->get('/framio/social-share/canva/callback', 'framio.social-share.canva.callback', Api\Controller\CanvaAuthController::class)
        ->post('/framio/social-share/canva/disconnect', 'framio.social-share.canva.disconnect', Api\Controller\CanvaAuthController::class)

        // 13. Canva Tasarım Oluşturma & Dışa Aktarma
        ->post('/framio/social-share/canva/design', 'framio.social-share.canva.design', Api\Controller\CanvaDesignController::class)

        // 14. Meta Business Suite (İstatistikler, Yorumlar, Mesajlar & Hikaye Yayınlama)
        ->get('/framio/social-share/meta-business', 'framio.social-share.meta-business.get', Api\Controller\MetaBusinessController::class)
        ->post('/framio/social-share/meta-business', 'framio.social-share.meta-business.post', Api\Controller\MetaBusinessController::class)

        // 15. Hikaye Arşivi (Story Archive & Cihazdan Yükleme)
        ->get('/framio/social-share/story-archive', 'framio.social-share.story-archive.get', Api\Controller\StoryArchiveController::class)
        ->post('/framio/social-share/story-archive', 'framio.social-share.story-archive.post', Api\Controller\StoryArchiveController::class),

    // Kullanıcı Tercihleri (Canva Per-User Token)
    (new Extend\User())
        ->registerPreference('canva_token_data')
        ->registerPreference('canva_user_profile'),

    // CLI Komutu ve Otomatik Zamanlayıcı (Her Dakika)
    (new Extend\Console())
        ->command(Command\ProcessQueueCommand::class)
        ->schedule(Command\ProcessQueueCommand::class, function (\Illuminate\Console\Scheduling\Event $event) {
            $event->everyMinute();
        }),

    // Ayarlar
    (new Extend\Settings())
        ->serializeToForum('framio-social-share.accounts_json', 'framio-social-share.accounts_json', [\Framio\SocialShare\Services\AccountTokens::class, 'publicJson'])
        ->serializeToForum('framio-social-share.default_account_index', 'framio-social-share.default_account_index', 'strval', '0')
        ->serializeToForum('framio-social-share.post_template', 'framio-social-share.post_template', 'strval', '')
        ->serializeToForum('framio-social-share.story_backgrounds_json', 'framio-social-share.story_backgrounds_json', 'strval', '[]')
        ->serializeToForum('framio-social-share.allowed_share_users', 'framio-social-share.allowed_share_users', 'strval', '')
        ->serializeToForum('framio-social-share.allowed_story_users', 'framio-social-share.allowed_story_users', 'strval', '')
        ->serializeToForum('framio-social-share.allowed_story_publish_users', 'framio-social-share.allowed_story_publish_users', 'strval', '')
        ->serializeToForum('framio-social-share.canva_team_users', 'framio-social-share.canva_team_users', 'strval', 'alikaankaya, ulasimarsiv, spottersturkey')
        ->serializeToForum('framio-social-share.canva_brand_users', 'framio-social-share.canva_brand_users', 'strval', '*')
        ->serializeToForum('framio-social-share.canva_brand_profile', 'framio-social-share.canva_brand_profile', 'strval', '')
        ->serializeToForum('framio-social-share.canva_template_links', 'framio-social-share.canva_template_links', 'strval', '')
        ->serializeToForum('framio-social-share.user_instagram_map', 'framio-social-share.user_instagram_map', 'strval', '')
        ->serializeToForum('framio-social-share.user_name_map', 'framio-social-share.user_name_map', 'strval', ''),
];

if (is_dir(__DIR__ . '/locale')) {
    $extenders[] = (new Extend\Locales(__DIR__.'/locale'));
}

return $extenders;