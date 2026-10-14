<?php

/*
 * framio/profiles — Framio konsolide eklenti paketi.
 */

use Flarum\Extend;

require_once dirname(__DIR__).'/common/ModuleManager.php';
use Framio\Common\ModuleManager;

return [
    // Pasif modül listesi (tarayıcı kodu buna göre modülü çalıştırmaz)
    ...ModuleManager::clientState(),

    ...ModuleManager::conditional('masquerade', require __DIR__.'/modules/masquerade/extend.php'),
    ...ModuleManager::conditional('socialprofile', require __DIR__.'/modules/socialprofile/extend.php'),
    ...ModuleManager::conditional('user-bio', require __DIR__.'/modules/user-bio/extend.php'),
    ...ModuleManager::conditional('usercard-stats', require __DIR__.'/modules/usercard-stats/extend.php'),
    ...ModuleManager::conditional('profile-image-crop', require __DIR__.'/modules/profile-image-crop/extend.php'),
    ...ModuleManager::conditional('rank-badges', require __DIR__.'/modules/rank-badges/extend.php'),
    ...ModuleManager::conditional('signature', require __DIR__.'/modules/signature/extend.php'),
    ...ModuleManager::conditional('profile-cover', require __DIR__.'/modules/profile-cover/extend.php'),
    ...ModuleManager::conditional('custom-profile-page', require __DIR__.'/modules/custom-profile-page/extend.php'),
    ...ModuleManager::conditional('profile-stories', require __DIR__.'/modules/profile-stories/extend.php'),
    ...ModuleManager::conditional('badges', require __DIR__.'/modules/badges/extend.php'),
    ...ModuleManager::conditional('user-map', require __DIR__.'/modules/user-map/extend.php'),
    ...ModuleManager::conditional('point-system', require __DIR__.'/modules/point-system/extend.php'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/resources/less/admin.less'),

    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js'),
];
