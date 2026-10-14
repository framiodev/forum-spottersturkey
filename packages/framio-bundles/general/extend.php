<?php

use Flarum\Extend;
use Framio\General\Api\Controller\SpeedStatsController;
use Framio\General\Api\Controller\RecordMetricController;
use Framio\General\Middleware\PageSpeedMiddleware;

require_once dirname(__DIR__).'/common/ModuleManager.php';
use Framio\Common\ModuleManager;

$isSpeedCache = ModuleManager::isEnabled('speed_cache');
$isModularis = ModuleManager::isEnabled('modularis');
$isGoogleFonts = ModuleManager::isEnabled('google_fonts');
$isLogoManager = ModuleManager::isEnabled('logo_manager');

$forumFrontend = (new Extend\Frontend('forum'))
    ->js(__DIR__.'/js/dist/forum.js')
    ->css(__DIR__.'/less/forum.less');

if ($isGoogleFonts) {
    $forumFrontend->content(\Framio\General\Listeners\InjectGoogleFonts::class);
}
if ($isLogoManager) {
    $forumFrontend->content(\Framio\General\Listeners\InjectLogoStyles::class);
}
if ($isModularis) {
    $forumFrontend->content(\Stezkoy\FlarumModularis\AddForumStyles::class);
}
// Karanlık Mod düzeltmeleri (vurgu rengi, palet, uyumluluk katmanı, özel CSS)
if (ModuleManager::isEnabled('dark_mode')) {
    $forumFrontend->content(\Framio\General\DarkMode\DarkModeStyles::class);
}

$adminFrontend = (new Extend\Frontend('admin'))
    ->js(__DIR__.'/js/dist/admin.js')
    ->css(__DIR__.'/less/admin.less');

if ($isModularis) {
    $adminFrontend->content(\Stezkoy\FlarumModularis\AddAdminStyles::class);
}
if (ModuleManager::isEnabled('dark_mode')) {
    $adminFrontend->content(\Framio\General\DarkMode\AdminDarkModeStyles::class);
}

$extenders = [
    // Pasif modül listesi (tarayıcı kodu buna göre modülü çalıştırmaz)
    ...ModuleManager::clientState(),

    $forumFrontend,
    $adminFrontend,

    new Extend\Locales(__DIR__.'/locale'),

    ...ModuleManager::conditional('backup', require __DIR__.'/modules/backup/extend.php'),

    (new Extend\Settings())
        ->default('framio-general.seamless_refresh', true)
        ->default('framio-general.mute_prompts', true)
        ->default('framio-general.google_fonts_body', '')
        ->default('framio-general.google_fonts_heading', '')
        ->default('framio-general.logo_desktop_height', '')
        ->default('framio-general.logo_mobile_height', '')
        ->default('framio-general.logo_alignment', 'left')
        ->default('framio-general.logo_dark_mode_url', '')
        ->default('framio-general.logo_seasonal_hat', false)
        ->default('framio-general.mobile_logo_enabled', false)
        ->default('framio-general.mobile_logo_source', 'favicon')
        ->default('framio-general.mobile_logo_custom_url', '')
        ->default('framio-general.mobile_logo_position', 'left')
        ->default('framio-general.mobile_logo_height', '32')
        ->default('framio-general.mobile_logo_link_home', true)
        ->default('framio-general.dm_accent_mode', 'auto')
        ->default('framio-general.dm_compat', true)
        ->default('framio-general.dm_palette', false)
        ->default('framio-general.dm_header_fix', true)
        ->default('framio-general.dm_user_switch', true)
        ->serializeToForum('framioGeneral.dmUserSwitch', 'framio-general.dm_user_switch', 'boolval')
        ->serializeToForum('framioGeneral.seamlessRefresh', 'framio-general.seamless_refresh', 'boolval')
        ->serializeToForum('framioGeneral.mutePrompts', 'framio-general.mute_prompts', 'boolval')
        ->serializeToForum('framioGeneral.googleFontsBody', 'framio-general.google_fonts_body')
        ->serializeToForum('framioGeneral.googleFontsHeading', 'framio-general.google_fonts_heading')
        ->serializeToForum('framioGeneral.logoDesktopHeight', 'framio-general.logo_desktop_height')
        ->serializeToForum('framioGeneral.logoMobileHeight', 'framio-general.logo_mobile_height')
        ->serializeToForum('framioGeneral.logoAlignment', 'framio-general.logo_alignment')
        ->serializeToForum('framioGeneral.logoDarkModeUrl', 'framio-general.logo_dark_mode_url')
        ->serializeToForum('framioGeneral.logoSeasonalHat', 'framio-general.logo_seasonal_hat', 'boolval')
        ->serializeToForum('framioGeneral.mobileLogoEnabled', 'framio-general.mobile_logo_enabled', 'boolval')
        ->serializeToForum('framioGeneral.mobileLogoSource', 'framio-general.mobile_logo_source')
        ->serializeToForum('framioGeneral.mobileLogoCustomUrl', 'framio-general.mobile_logo_custom_url')
        ->serializeToForum('framioGeneral.mobileLogoPosition', 'framio-general.mobile_logo_position')
        ->serializeToForum('framioGeneral.mobileLogoHeight', 'framio-general.mobile_logo_height', 'intval')
        ->serializeToForum('framioGeneral.mobileLogoLinkHome', 'framio-general.mobile_logo_link_home', 'boolval'),
];

if ($isModularis) {
    $extenders[] = new Extend\Locales(__DIR__.'/modules/modularis/locale');
    $extenders[] = new Extend\ApiResource(\Stezkoy\FlarumModularis\Api\Resource\StyleResource::class);
    $extenders[] = (new Extend\Event())->subscribe(\Stezkoy\FlarumModularis\Listener\ClearCache::class);
}

// Hata Günlüğü & Debug: debug modu kapalıyken de hataları toplar
if (ModuleManager::isEnabled('debug_log')) {
    $extenders[] = (new Extend\ErrorHandling())->reporter(\Framio\General\Debug\DebugReporter::class);
    foreach (['forum', 'admin', 'api'] as $frontend) {
        $extenders[] = (new Extend\Middleware($frontend))->add(\Framio\General\Debug\RequestContext::class);
    }
    $extenders[] = (new Extend\Routes('api'))
        ->get('/framio/debug-logs', 'framio.debug-logs.index', \Framio\General\Api\Controller\DebugLogController::class)
        ->get('/framio/debug-logs/{id:\d+}', 'framio.debug-logs.show', \Framio\General\Api\Controller\DebugLogController::class)
        ->post('/framio/debug-logs', 'framio.debug-logs.action', \Framio\General\Api\Controller\DebugLogController::class)
        ->post('/framio/debug-logs/client', 'framio.debug-logs.client', \Framio\General\Api\Controller\DebugLogController::class);
    $extenders[] = (new Extend\Settings())
        ->default('framio-general.debug_log_enabled', true)
        ->default('framio-general.debug_log_client', true)
        ->default('framio-general.debug_log_max', 2000)
        ->serializeToForum('framioGeneral.debugClient', 'framio-general.debug_log_client', 'boolval');
}

// Web cron: zamanlanmış içerik komutlarının dış servisle sık tetiklenmesi (paylaşımlı hosting cron sınırı için)
$extenders[] = (new Extend\Routes('forum'))
    ->get('/framio-cron/{token:[A-Za-z0-9]{32,64}}', 'framio.web-cron', \Framio\General\Cron\WebCronController::class);
$extenders[] = (new Extend\Settings())
    ->default('framio-general.web_cron_enabled', false)
    ->default('framio-general.web_cron_min_interval', 120);

if ($isSpeedCache) {
    $extenders[] = (new Extend\Routes('api'))
        ->get('/framio/speed-stats', 'framio.speed-stats', SpeedStatsController::class)
        ->post('/framio/speed-stats', 'framio.speed-stats.post', SpeedStatsController::class)
        ->post('/framio/record-metric', 'framio.record-metric', RecordMetricController::class);

    $extenders[] = (new Extend\Middleware('forum'))->add(PageSpeedMiddleware::class);
    $extenders[] = (new Extend\Middleware('admin'))->add(PageSpeedMiddleware::class);
}

// php flarum framio:migrate — birleşik paketlere geçişte eski adla uygulanmış göçleri kaydederek ilerler
$extenders[] = (new Extend\Console())->command(\Framio\General\Database\SafeMigrateCommand::class);

return $extenders;
