<?php

/*
 * framio/package-manager — Framio Konsolide Paket & Modül Yöneticisi
 */

use Flarum\Extend;
use Framio\PackageManager\Api\Controller\CheckUpdateController;
use Framio\PackageManager\Api\Controller\CreateBundleController;
use Framio\PackageManager\Api\Controller\DeleteModuleController;
use Framio\PackageManager\Api\Controller\GetOverviewController;
use Framio\PackageManager\Api\Controller\InstallExtensionController;
use Framio\PackageManager\Api\Controller\PackagistSearchController;
use Framio\PackageManager\Api\Controller\SetModuleMetaController;
use Framio\PackageManager\Api\Controller\ToggleModuleController;
use Framio\PackageManager\Api\Controller\UpdateModuleController;

return [
    (new Extend\Routes('api'))
        ->get('/framio/package-manager/overview', 'framio.package-manager.overview', GetOverviewController::class)
        ->post('/framio/package-manager/toggle', 'framio.package-manager.toggle', ToggleModuleController::class)
        ->get('/framio/package-manager/search', 'framio.package-manager.search', PackagistSearchController::class)
        ->post('/framio/package-manager/install', 'framio.package-manager.install', InstallExtensionController::class)
        ->post('/framio/package-manager/create-bundle', 'framio.package-manager.create-bundle', CreateBundleController::class)
        ->post('/framio/package-manager/delete-module', 'framio.package-manager.delete-module', DeleteModuleController::class)
        ->get('/framio/package-manager/check-update', 'framio.package-manager.check-update', CheckUpdateController::class)
        ->post('/framio/package-manager/update-module', 'framio.package-manager.update-module', UpdateModuleController::class)
        ->post('/framio/package-manager/set-meta', 'framio.package-manager.set-meta', SetModuleMetaController::class),

    (new Extend\Frontend('admin'))
        ->js(__DIR__ . '/js/dist/admin.js')
        ->css(__DIR__ . '/resources/less/admin.less'),

    new Extend\Locales(__DIR__ . '/locale'),
];
