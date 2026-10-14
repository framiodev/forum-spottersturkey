<?php

/*
 * framio/content — Framio konsolide eklenti paketi.
 */

use Flarum\Extend;

require_once dirname(__DIR__).'/common/ModuleManager.php';
use Framio\Common\ModuleManager;

return [
    // Pasif modül listesi (tarayıcı kodu buna göre modülü çalıştırmaz)
    ...ModuleManager::clientState(),

    ...ModuleManager::conditional('pages', require __DIR__.'/modules/pages/extend.php'),
    ...ModuleManager::conditional('links', require __DIR__.'/modules/links/extend.php'),
    ...ModuleManager::conditional('drafts', require __DIR__.'/modules/drafts/extend.php'),
    ...ModuleManager::conditional('formatting', require __DIR__.'/modules/formatting/extend.php'),
    ...ModuleManager::conditional('discussion-thumbnail', require __DIR__.'/modules/discussion-thumbnail/extend.php'),
    ...ModuleManager::conditional('flamoji', require __DIR__.'/modules/flamoji/extend.php'),
    ...ModuleManager::conditional('hashtags', require __DIR__.'/modules/hashtags/extend.php'),
    ...ModuleManager::conditional('deep-tags', require __DIR__.'/modules/deep-tags/extend.php'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/resources/less/admin.less'),

    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/resources/less/forum.less'),
];
