<?php

namespace Framio\UploadExif;

use Flarum\Extend;
use s9e\TextFormatter\Configurator;
use Framio\UploadExif\Api\Controller\UploadImageController;
use Framio\UploadExif\Api\Controller\ShowImageController;
use Framio\UploadExif\Api\Controller\ListImagesController;
use Framio\UploadExif\Api\Controller\DeleteImageController;
use Framio\UploadExif\Api\Controller\EditImageController;
use Framio\UploadExif\Api\Controller\EditCustomDataController;
use Framio\UploadExif\Api\Controller\WatermarkManagementController;
use Framio\UploadExif\Api\Controller\ListTaxonomyController;
use Framio\UploadExif\Api\Controller\SaveTaxonomyController;
use Framio\UploadExif\Api\Controller\ListCityRoutesController;
use Framio\UploadExif\Api\Controller\SaveCityRoutesController;
use Framio\UploadExif\Api\Controller\SearchMusicController;
use Framio\UploadExif\Api\Controller\ConvertFormatController;
use Framio\UploadExif\Api\Controller\UpdateRetroactiveAltTagsController;
use Framio\UploadExif\Api\Controller\AnalyzeMediaAiController;
use Framio\UploadExif\Api\Controller\ListCategorySchemasController;
use Framio\UploadExif\Api\Controller\SaveCategorySchemaController;
use Framio\UploadExif\Api\Controller\DownloadImageController;
use Framio\UploadExif\Api\Controller\MigrateMediaTagsController;
use Framio\UploadExif\PostAs\PostAsHandler;
use Flarum\Api\Context;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\PostResource;
use Flarum\Api\Schema;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/resources/less/forum.less')
        ->css(__DIR__.'/resources/less/framio-user-gallery.less')
        // Görsel sunucusuyla bağlantı sayfa açılırken kurulur (ilk görsel DNS/TLS beklemez)
        ->content(function (\Flarum\Frontend\Document $document) {
            $domain = rtrim(trim((string) resolve(\Flarum\Settings\SettingsRepositoryInterface::class)->get('framio-upload-exif.custom_domain')), '/');
            if ($domain !== '' && preg_match('#^https?://[^/]+#', $domain, $m)) {
                $document->head[] = '<link rel="preconnect" href="' . e($m[0]) . '" crossorigin>';
                $document->head[] = '<link rel="dns-prefetch" href="' . e($m[0]) . '">';
            }
        }),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/resources/less/admin.less'),

    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\Routes('api'))
        // Medya Yükleme & Görüntüleme & İndirme
        ->post('/framio-media/upload', 'framio.media.upload', UploadImageController::class)
        // Gönderi istatistikleri (toplama herkese açık, görüntüleme yalnızca yönetici)
        ->post('/framio-insights/track', 'framio.insights.track', \Framio\UploadExif\Insights\TrackInsightsController::class)
        ->get('/framio-insights', 'framio.insights.show', \Framio\UploadExif\Insights\ShowInsightsController::class)
        ->get('/framio-media/image/{id}', 'framio.media.show', ShowImageController::class)
        ->get('/framio-media/download/{id}', 'framio.media.download', DownloadImageController::class)
        ->get('/framio-media/images', 'framio.media.images.list', ListImagesController::class)
        ->get('/framio-media/images/all', 'framio.media.images.admin_list', ListImagesController::class)
        ->delete('/framio-media/image/{id}', 'framio.media.delete', DeleteImageController::class)
        ->patch('/framio-media/image/{id}', 'framio.media.update', EditImageController::class)
        ->patch('/framio-media/image/{id}/custom-data', 'framio.media.update.custom_data', EditCustomDataController::class)

        // Filigran / Watermark Yönetimi (List, Upload, Delete)
        ->get('/framio-media/watermarks', 'framio.media.watermarks.list', WatermarkManagementController::class)
        ->post('/framio-media/watermarks', 'framio.media.watermarks.upload', WatermarkManagementController::class)
        ->delete('/framio-media/watermarks', 'framio.media.watermarks.delete', WatermarkManagementController::class)

        // Dinamik Taksonomi (Marka / Model)
        ->get('/framio-media/taxonomy', 'framio.media.taxonomy.list', ListTaxonomyController::class)
        ->post('/framio-media/taxonomy', 'framio.media.taxonomy.save', SaveTaxonomyController::class)

        // Şehiriçi Hatlar
        ->get('/framio-media/city-routes', 'framio.media.cityroutes.list', ListCityRoutesController::class)
        ->post('/framio-media/city-routes', 'framio.media.cityroutes.save', SaveCityRoutesController::class)

        // Dinamik Kategori Şemaları
        ->get('/framio-media/category-schemas', 'framio.media.category_schemas.list', ListCategorySchemasController::class)
        ->post('/framio-media/category-schemas', 'framio.media.category_schemas.save', SaveCategorySchemaController::class)

        // BBCode Etiket Dönüştürme / Migration
        ->post('/framio-media/migrate-tags', 'framio.media.migrate_tags', MigrateMediaTagsController::class)

        // Müzik Arama
        ->get('/framio-media/music/search', 'framio.media.music.search', SearchMusicController::class)

        // Toplu Format Dönüştürme (WebP <-> JPG)
        ->post('/framio-media/convert-format', 'framio.media.convert', ConvertFormatController::class)
        ->get('/framio-media/convert-format/runs', 'framio.media.convert.runs', \Framio\UploadExif\Api\Controller\RevertConversionController::class)
        ->post('/framio-media/convert-format/revert', 'framio.media.convert.revert', \Framio\UploadExif\Api\Controller\RevertConversionController::class)

        // Retroaktif Alt Tag & SEO Güncelleme
        ->post('/framio-media/update-alt-tags', 'framio.media.update_alt_tags', UpdateRetroactiveAltTagsController::class)

        // AI Analiz & Künye Otomatik Doldurma
        ->post('/framio-media/analyze-ai', 'framio.media.analyze_ai', AnalyzeMediaAiController::class)
        // Framio AI marka/model yazım eşlemesi: künye onayında düzeltme öğrenilir
        ->post('/framio-media/ai-alias', 'framio.media.ai_alias', \Framio\UploadExif\Api\Controller\AiAliasController::class)
        // Yazım standardını eski gönderilere uygulama (admin)
        ->get('/framio-media/canon', 'framio.media.canon', \Framio\UploadExif\Api\Controller\CanonRulesController::class)
        ->post('/framio-media/canon', 'framio.media.canon.apply', \Framio\UploadExif\Api\Controller\CanonRulesController::class)
        // Otomatik koleksiyon başlıkları: geçmiş gönderileri tara / ekle (admin)
        ->post('/framio-media/auto-collect', 'framio.media.auto_collect', \Framio\UploadExif\Api\Controller\AutoCollectController::class)
        // Framio AI model referans görselleri (admin)
        ->get('/framio-media/ai-refs', 'framio.media.ai_refs', \Framio\UploadExif\Api\Controller\ModelRefsController::class)
        ->post('/framio-media/ai-refs', 'framio.media.ai_refs.save', \Framio\UploadExif\Api\Controller\ModelRefsController::class)
        ->get('/framio-media/ai-test', 'framio.media.ai_test', \Framio\UploadExif\Api\Controller\AiTestController::class)

        // Framio Asistan (sesli / yazılı komut)
        ->post('/framio-assistant/parse', 'framio.assistant.parse', \Framio\UploadExif\Assistant\AssistantController::class)
        ->post('/framio-assistant/canon', 'framio.assistant.canon', \Framio\UploadExif\Assistant\AssistantController::class)
        ->post('/framio-assistant/route', 'framio.assistant.route', \Framio\UploadExif\Assistant\AssistantController::class)
        ->post('/framio-assistant/learn', 'framio.assistant.learn', \Framio\UploadExif\Assistant\AssistantController::class)
        ->post('/framio-assistant/forget', 'framio.assistant.forget', \Framio\UploadExif\Assistant\AssistantController::class)
        ->get('/framio-assistant/history', 'framio.assistant.history', \Framio\UploadExif\Assistant\AssistantController::class)
        ->post('/framio-assistant/history', 'framio.assistant.history.add', \Framio\UploadExif\Assistant\AssistantController::class)
        ->delete('/framio-assistant/history', 'framio.assistant.history.clear', \Framio\UploadExif\Assistant\AssistantController::class)
        ->get('/framio-assistant/conversations', 'framio.assistant.conversations', \Framio\UploadExif\Assistant\AssistantController::class)
        ->post('/framio-assistant/conversations', 'framio.assistant.conversations.update', \Framio\UploadExif\Assistant\AssistantController::class)
        ->delete('/framio-assistant/conversations', 'framio.assistant.conversations.delete', \Framio\UploadExif\Assistant\AssistantController::class)
        ->get('/framio-assistant/schedule', 'framio.assistant.schedule', \Framio\UploadExif\Assistant\AssistantController::class)
        ->post('/framio-assistant/schedule', 'framio.assistant.schedule.add', \Framio\UploadExif\Assistant\AssistantController::class)
        ->post('/framio-assistant/schedule/cancel', 'framio.assistant.schedule.cancel', \Framio\UploadExif\Assistant\AssistantController::class)
        ->post('/framio-assistant/seen', 'framio.assistant.seen', \Framio\UploadExif\Assistant\AssistantController::class)
        ->post('/framio-assistant/targets', 'framio.assistant.targets', \Framio\UploadExif\Assistant\AssistantController::class)

        // Canlı güncelleme (yeni sürüm ve yeni mesajlar)
        ->get('/framio/live', 'framio.live', \Framio\UploadExif\Api\Controller\LiveController::class),

    // Admin Ayarlarının Frontend Forum Context'ine Aktarımı
    (new Extend\Settings())
        ->serializeToForum('framio-upload-exif.show_exif_publicly', 'framio-upload-exif.show_exif_publicly')
        ->serializeToForum('framio-upload-exif.enable_carousel_mode', 'framio-upload-exif.enable_carousel_mode')
        ->serializeToForum('framio-upload-exif.watermark_mode', 'framio-upload-exif.watermark_mode') // 'templates' | 'personal' | 'hybrid'
        ->serializeToForum('framio-upload-exif.ai_enabled', 'framio-upload-exif.ai_enabled')
        // Yazım standardı: künye onaylanırken kullanıcının yazdığı da tek tip hale gelir
        ->serializeToForum('framio-upload-exif.canon_rules', 'framio-upload-exif.canon_rules')
        ->serializeToForum('framio-upload-exif.ai_provider', 'framio-upload-exif.ai_provider')
        ->serializeToForum('framio-upload-exif.ai_model', 'framio-upload-exif.ai_model')
        ->serializeToForum('framio-upload-exif.allow_user_ai_keys', 'framio-upload-exif.allow_user_ai_keys')
        ->serializeToForum('framio-upload-exif.image_format', 'framio-upload-exif.image_format')
        ->serializeToForum('framio-upload-exif.brand_order', 'framio-upload-exif.brand_order')
        ->serializeToForum('framio-upload-exif.category_schemas_enabled', 'framio-upload-exif.category_schemas_enabled')
        ->serializeToForum('framio-upload-exif.kunye_theme', 'framio-upload-exif.kunye_theme')
        ->serializeToForum('framio-upload-exif.exif_theme', 'framio-upload-exif.exif_theme')
        ->serializeToForum('framio-upload-exif.download_format_mode', 'framio-upload-exif.download_format_mode')
        ->serializeToForum('framio-upload-exif.active_bbcode_tag', 'framio-upload-exif.active_bbcode_tag')
        ->serializeToForum('framio-upload-exif.recognized_bbcode_tags', 'framio-upload-exif.recognized_bbcode_tags')
        // Framio Asistan: açık/kapalı ve sitenin uyandırma sözü (arayüzde gösterilmez; yalnızca admin ayarlar)
        // Asistandaki model seçimi: admin'de açık sağlayıcılar (anahtar GÖNDERİLMEZ, yalnızca ad ve model)
        ->serializeToForum('framioAiModels', 'framio-upload-exif.ai_providers', function ($v) {
            $out = [];
            foreach ((array) json_decode((string) $v, true) as $row) {
                if (!is_array($row) || !($row['enabled'] ?? true) || empty($row['provider'])) continue;
                $p = (string) $row['provider'];
                $def = \Framio\UploadExif\Ai\VisionAnalyzer::PROVIDERS[$p] ?? null;
                if (!$def) continue;
                $model = trim((string) ($row['model'] ?? '')) ?: $def['model'];
                $out[] = ['id' => $p . '|' . $model, 'label' => $def['name'] . ' · ' . $model];
                if ($p === 'gemini') $out[] = ['id' => 'gemini|gemini-3.8-flash', 'label' => $def['name'] . ' · gemini-3.8-flash (güçlü)'];
            }

            return array_values(array_unique($out, SORT_REGULAR));
        }, '[]')
        ->serializeToForum('framioAssistantEnabled', 'framio-upload-exif.assistant_enabled', fn ($v) => $v !== '0', true)
        ->serializeToForum('framioAssistantWake', 'framio-upload-exif.assistant_wake', 'strval', '')
        ->serializeToForum('framioAssistantAutoAfter', 'framio-upload-exif.assistant_auto_after', 'intval', 3)
        ->serializeToForum('framioAssistantLauncher', 'framio-upload-exif.assistant_launcher', 'strval', 'fab')
        ->serializeToForum('framioAssistantPosition', 'framio-upload-exif.assistant_position', 'strval', 'right')
        ->serializeToForum('framioAssistantShowActions', 'framio-upload-exif.assistant_show_actions', fn ($v) => $v !== '0', true)
        ->serializeToForum('framioAssistantSay', 'framio-upload-exif.assistant_pronounce', 'strval', '')
        // Google Drive (yalnızca okuma): OAuth istemci kimliği, API anahtarı ve proje numarası tarayıcıda kullanılan
        // herkese açık tanımlayıcılardır (gizli anahtar değildir); Google Cloud'da alan adıyla kısıtlanmalıdır
        ->serializeToForum('framioLiveEnabled', 'framio-upload-exif.live_enabled', fn ($v) => $v !== '0', true)
        ->serializeToForum('framioLiveInterval', 'framio-upload-exif.live_interval', 'intval', 30),

    (new Extend\User())
        ->registerPreference('framio_carousel_enabled', 'boolval', true)
        ->registerPreference('framio_personal_ai_provider', 'strval', 'default')
        ->registerPreference('framio_personal_ai_key', 'strval', '')
        ->registerPreference('framio_personal_ai_model', 'strval', '')
        // Kişisel asistan
        ->registerPreference('framio_assistant_name', 'strval', '')
        ->registerPreference('framio_assistant_wake', 'strval', '')
        ->registerPreference('framio_assistant_listen', 'boolval', false)
        ->registerPreference('framio_assistant_speak', 'boolval', true)
        ->registerPreference('framio_assistant_auto', 'boolval', true)
        ->registerPreference('framio_assistant_watermark', 'strval', 'none')
        ->registerPreference('framio_assistant_depth', 'intval', 2)
        // Boş: sitenin varsayılanı geçerli
        ->registerPreference('framio_assistant_show_actions', fn ($v) => $v === null || $v === '' ? null : (bool) $v, null),

    // BBCode Formatlayıcı (Çoklu Etiket & Geriye Dönük Tam Uyumluluk)
    (new Extend\Formatter)
        ->configure(function (Configurator $config) {
            // 1. Yeni Framio Etiketi
            $config->BBCodes->addCustom(
                '[framio-image id={NUMBER} url={URL} alt={TEXT}]',
                '<div class="framio-image-container SpotterCard" data-id="{NUMBER}">
                    <div class="SpotterCard-image-wrapper">
                        <img src="{URL}" alt="{TEXT}" class="spotter-lazy" loading="lazy" decoding="async"><xsl:if test="@w and @h"><xsl:attribute name="width"><xsl:value-of select="@w"/></xsl:attribute><xsl:attribute name="height"><xsl:value-of select="@h"/></xsl:attribute></xsl:if></img>
                    </div>
                    <div class="spotter-exif-placeholder"></div>
                 </div>'
            );

            // 2. Spotters Turkey Etiketi (Geriye Dönük)
            $config->BBCodes->addCustom(
                '[spotter-image id={NUMBER} url={URL} alt={TEXT}]',
                '<div class="framio-image-container spotter-image-container SpotterCard" data-id="{NUMBER}">
                    <div class="SpotterCard-image-wrapper">
                        <img src="{URL}" alt="{TEXT}" class="spotter-lazy" loading="lazy" decoding="async"><xsl:if test="@w and @h"><xsl:attribute name="width"><xsl:value-of select="@w"/></xsl:attribute><xsl:attribute name="height"><xsl:value-of select="@h"/></xsl:attribute></xsl:if></img>
                    </div>
                    <div class="spotter-exif-placeholder"></div>
                 </div>'
            );

            // 3. Ulaşım Arşiv Etiketi (Geriye Dönük)
            $config->BBCodes->addCustom(
                '[ulasimarsiv-image id={NUMBER} url={URL} alt={TEXT}]',
                '<div class="framio-image-container ulasimarsiv-image-container SpotterCard" data-id="{NUMBER}">
                    <div class="SpotterCard-image-wrapper">
                        <img src="{URL}" alt="{TEXT}" class="spotter-lazy" loading="lazy" decoding="async"><xsl:if test="@w and @h"><xsl:attribute name="width"><xsl:value-of select="@w"/></xsl:attribute><xsl:attribute name="height"><xsl:value-of select="@h"/></xsl:attribute></xsl:if></img>
                    </div>
                    <div class="spotter-exif-placeholder"></div>
                 </div>'
            );
            
            // 4. Standart Flarum Upload Uyumluluğu
            $config->BBCodes->addCustom(
                '[upl-image-preview id={NUMBER} url={URL} alt={TEXT}]',
                '<div class="framio-image-container upl-image-container SpotterCard" data-id="{NUMBER}">
                    <div class="SpotterCard-image-wrapper">
                        <img src="{URL}" alt="{TEXT}" class="spotter-lazy" loading="lazy" decoding="async"><xsl:if test="@w and @h"><xsl:attribute name="width"><xsl:value-of select="@w"/></xsl:attribute><xsl:attribute name="height"><xsl:value-of select="@h"/></xsl:attribute></xsl:if></img>
                    </div>
                    <div class="spotter-exif-placeholder"></div>
                 </div>'
            );

            // Künye Kartları
            $config->BBCodes->addCustom(
                '[framio-kunye theme={IDENTIFIER}]{TEXT}[/framio-kunye]',
                '<div class="framio-kunye-card"><xsl:apply-templates/></div>'
            );
            $config->BBCodes->addCustom(
                '[framio-kunye]{TEXT}[/framio-kunye]',
                '<div class="framio-kunye-card"><xsl:apply-templates/></div>'
            );
        }),

    // Görsellere gerçek en/boy: sayfa kaydırılırken mesajlar zıplamasın
    (new Extend\Formatter)
        ->render(\Framio\UploadExif\Formatter\AddImageDimensions::class),

    // Google Drive bağlantı bilgileri yalnızca admin'de izin verilen kullanıcılara gönderilir
    // (liste boşsa yalnızca yöneticiler); diğer üyeler Drive seçeneğini hiç görmez
    (new Extend\ApiResource(\Flarum\Api\Resource\ForumResource::class))
        ->fields(fn () => array_map(
            fn ($attr, $key) => Schema\Str::make($attr)->get(function ($forum, Context $context) use ($key) {
                $actor = $context->getActor();
                if ($actor->isGuest()) return '';
                $settings = resolve(\Flarum\Settings\SettingsRepositoryInterface::class);
                $allowed = array_filter(array_map(fn ($u) => mb_strtolower(trim(ltrim($u, '@')), 'UTF-8'), preg_split('/[,\n]+/', (string) $settings->get('framio-upload-exif.drive_users'))));
                $ok = $allowed ? in_array(mb_strtolower($actor->username, 'UTF-8'), $allowed, true) : $actor->isAdmin();

                return $ok ? (string) $settings->get('framio-upload-exif.' . $key) : '';
            }),
            ['framioDriveClientId', 'framioDriveApiKey', 'framioDriveAppId'],
            ['drive_client_id', 'drive_api_key', 'drive_app_id']
        )),

    // Yönetici: konuyu/mesajı seçilen üye adına paylaş (bkz. PostAsHandler)
    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(fn () => [
            Schema\Integer::make('framioPostAs')
                ->writable(fn ($model, Context $context) => $context->creating() && $context->getActor()->isAdmin())
                ->visible(false)
                ->set(fn () => null),
        ]),
    (new Extend\ApiResource(PostResource::class))
        ->fields(fn () => [
            Schema\Integer::make('framioPostAs')
                ->writable(fn ($model, Context $context) => $context->creating() && $context->getActor()->isAdmin())
                ->visible(false)
                ->set(fn () => null),
        ]),
    (new Extend\Event())
        ->listen(\Flarum\Discussion\Event\Saving::class, PostAsHandler::class.'@discussion')
        ->listen(\Flarum\Post\Event\Saving::class, PostAsHandler::class.'@post'),

    (new Extend\Console())
        // Yeni görsellerin küçültülmüş boyutları ziyaretçiden önce üretilir
        ->command(\Framio\UploadExif\Console\WarmSizesCommand::class)
        ->schedule(\Framio\UploadExif\Console\WarmSizesCommand::class, fn ($e) => $e->everyTenMinutes()->withoutOverlapping())
        // Otomatik koleksiyon başlıkları: yeni fotoğraflı gönderiler
        ->command(\Framio\UploadExif\Console\AutoCollectCommand::class)
        ->schedule(\Framio\UploadExif\Console\AutoCollectCommand::class, fn ($e) => $e->everyTenMinutes()->withoutOverlapping())
        ->command(\Framio\UploadExif\Console\FillDimensionsCommand::class)
        ->command(\Framio\UploadExif\Console\VisionIndexCommand::class)
        ->command(\Framio\UploadExif\Console\AssistantRunCommand::class)
        // Planlı paylaşımlar dakikada bir (Flarum zamanlayıcısı: cron'da "php flarum schedule:run")
        ->schedule(\Framio\UploadExif\Console\AssistantRunCommand::class, fn ($event) => $event->everyMinute()->withoutOverlapping()),
];
