<?php

/*
 * framio/community — Framio konsolide eklenti paketi.
 *
 * Her modül, kendi extend.php dosyasını döndürür. Modül yöneticisi (ModuleManager)
 * aracılığıyla yönetici panelinden pasife çekilen modüller yüklenmez.
 */

use Flarum\Extend;

require_once dirname(__DIR__).'/common/ModuleManager.php';
use Framio\Common\ModuleManager;

return [
    // Pasif modül listesi (tarayıcı kodu buna göre modülü çalıştırmaz)
    ...ModuleManager::clientState(),

    ...ModuleManager::conditional('user-directory', require __DIR__.'/modules/user-directory/extend.php'),
    ...ModuleManager::conditional('ignore-users', require __DIR__.'/modules/ignore-users/extend.php'),
    ...ModuleManager::conditional('subscribed', require __DIR__.'/modules/subscribed/extend.php'),
    ...ModuleManager::conditional('default-group', require __DIR__.'/modules/default-group/extend.php'),
    ...ModuleManager::conditional('default-user-preferences', require __DIR__.'/modules/default-user-preferences/extend.php'),
    ...ModuleManager::conditional('mailing', require __DIR__.'/modules/mailing/extend.php'),
    ...ModuleManager::conditional('language-detection', require __DIR__.'/modules/language-detection/extend.php'),
    ...ModuleManager::conditional('notifications', require __DIR__.'/modules/notifications/extend.php'),
    ...ModuleManager::conditional('friendship', require __DIR__.'/modules/friendship/extend.php'),
    ...ModuleManager::conditional('follow-tags', require __DIR__.'/modules/follow-tags/extend.php'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/resources/less/admin.less'),

    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js'),
];
