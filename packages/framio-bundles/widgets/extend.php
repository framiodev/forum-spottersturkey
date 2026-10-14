<?php

/*
 * framio/widgets — Framio konsolide eklenti paketi.
 */

use Flarum\Extend;

require_once dirname(__DIR__).'/common/ModuleManager.php';
use Framio\Common\ModuleManager;

return [
    // Pasif modül listesi (tarayıcı kodu buna göre modülü çalıştırmaz)
    ...ModuleManager::clientState(),

    ...ModuleManager::conditional('forum-widgets-core', require __DIR__.'/modules/forum-widgets-core/extend.php'),
    ...ModuleManager::conditional('forum-statistics-widget', require __DIR__.'/modules/forum-statistics-widget/extend.php'),
    ...ModuleManager::conditional('frontpage', require __DIR__.'/modules/frontpage/extend.php'),
    ...ModuleManager::conditional('socialcards', require __DIR__.'/modules/socialcards/extend.php'),
    ...ModuleManager::conditional('online-users', require __DIR__.'/modules/online-users-widget/extend.php'),
    ...ModuleManager::conditional('top-posters', require __DIR__.'/modules/top-posters-widget/extend.php'),
    ...ModuleManager::conditional('news-widget', require __DIR__.'/modules/news-widget/extend.php'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/resources/less/admin.less'),

    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js'),
];
