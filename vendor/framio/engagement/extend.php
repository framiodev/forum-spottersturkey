<?php

/*
 * framio/engagement — Framio konsolide eklenti paketi.
 */

use Flarum\Extend;

require_once dirname(__DIR__).'/common/ModuleManager.php';
use Framio\Common\ModuleManager;

return [
    // Pasif modül listesi (tarayıcı kodu buna göre modülü çalıştırmaz)
    ...ModuleManager::clientState(),

    ...ModuleManager::conditional('reactions', require __DIR__.'/modules/reactions/extend.php'),
    ...ModuleManager::conditional('polls', require __DIR__.'/modules/polls/extend.php'),
    ...ModuleManager::conditional('discussion-views', require __DIR__.'/modules/discussion-views/extend.php'),
    ...ModuleManager::conditional('share-social', require __DIR__.'/modules/share-social/extend.php'),
    ...ModuleManager::conditional('who-read', require __DIR__.'/modules/who-read/extend.php'),
    ...ModuleManager::conditional('bookmarks', require __DIR__.'/modules/bookmarks/extend.php'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/resources/less/admin.less'),

    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js'),
];
