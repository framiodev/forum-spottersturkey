<?php

/*
 * framio/moderation — Framio konsolide eklenti paketi.
 */

use Flarum\Extend;

require_once dirname(__DIR__).'/common/ModuleManager.php';
use Framio\Common\ModuleManager;

return [
    // Pasif modül listesi (tarayıcı kodu buna göre modülü çalıştırmaz)
    ...ModuleManager::clientState(),

    ...ModuleManager::conditional('moderator-notes', require __DIR__.'/modules/moderator-notes/extend.php'),
    ...ModuleManager::conditional('moderator-warnings', require __DIR__.'/modules/moderator-warnings/extend.php'),
    ...ModuleManager::conditional('author-change', require __DIR__.'/modules/author-change/extend.php'),
    ...ModuleManager::conditional('merge-discussions', require __DIR__.'/modules/merge-discussions/extend.php'),
    ...ModuleManager::conditional('move-posts', require __DIR__.'/modules/move-posts/extend.php'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/resources/less/admin.less'),

    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js'),
];
