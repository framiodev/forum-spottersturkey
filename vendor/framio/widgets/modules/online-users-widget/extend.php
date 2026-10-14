<?php

/*
 * This file is part of fof/online-users-widget.
 *
 * Copyright (c) 2021 Friends of Flarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\OnlineUsers;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Flarum\User\User;

/**
 * Resolve the online users once per request.
 *
 * `totalOnlineUsers` and the `onlineUsers` relationship both need the same
 * result, and each field callback would otherwise repeat the queries.
 *
 * Memoized in a local rather than on the Context: the serializer hands each
 * field its own Context (`withField()` clones), so `setParam()` writes would
 * not be visible to the sibling field. Keyed by actor so nothing leaks between
 * actors should the closure outlive one request.
 */
$memo = [];

$resolve = function (Context $context) use (&$memo): array {
    $actor = $context->getActor();

    return $memo[$actor->id ?? 'guest'] ??= resolve(UserRepository::class)->getOnlineUsers($actor);
};

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/less/forum.less')
        // Çevrimiçi üyelerin tam listesi ve ne yaptıkları
        ->route('/cevrimici', 'framio.online'),

    new Extend\Locales(__DIR__.'/locale'),

    (new Extend\ApiResource(Resource\ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('canViewOnlineUsersWidget')
                ->get(fn ($model, Context $context) => $context->getActor()->hasPermission('viewOnlineUsersWidget')),

            Schema\Integer::make('totalOnlineUsers')
                ->get(fn ($model, Context $context) => $resolve($context)['count']),

            Schema\Relationship\ToMany::make('onlineUsers')
                ->type('users')
                ->includable()
                ->get(fn ($model, Context $context) => $resolve($context)['users']),
        ])
        ->endpoint(Endpoint\Show::class, fn (Endpoint\Show $endpoint) => $endpoint->addDefaultInclude(['onlineUsers'])),

    // Without this guard any logged-in user could subscribe to `presence-online`
    // and enumerate who is connected, regardless of the permission the widget
    // itself enforces. Realtime's own docblock for this hook uses this very
    // permission as its worked example.
    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-realtime', fn () => [
            (new \Flarum\Realtime\Extend\Realtime())
                ->authorizePresenceChannel(
                    'online',
                    fn (User $actor) => $actor->hasPermission('viewOnlineUsersWidget')
                ),
        ]),

    (new Extend\Settings())
        ->default('fof-online-users-widget.max_users', 15)
        ->default('fof-online-users-widget.cache_ttl', 30)
        ->default('fof-online-users-widget.last_seen_interval', 5)
        ->default('framio-activity.enabled', '1')
        ->serializeToForum('framioActivityEnabled', 'framio-activity.enabled', 'boolval'),

    // ── Anlık etkinlik (kim ne yapıyor)
    (new Extend\Routes('api'))
        ->post('/framio-activity', 'framio-activity.record', Activity\ActivityController::class)
        ->get('/framio-activity/online', 'framio-activity.online', Activity\ActivityController::class),

    // Üyenin "Çevrimiçiyken ne yaptığımı göster" tercihi (varsayılan: açık)
    (new Extend\User())
        ->registerPreference('framioDiscloseActivity', 'boolval', true),

    (new Extend\ApiResource(Resource\ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('canViewUserActivity')
                ->get(fn ($model, Context $context) => resolve(Activity\ActivityResolver::class)->canView($context->getActor())),
        ]),

    // Profil kartı: yalnızca tek kullanıcı gösterilirken (listelerde sorgu yükü olmasın)
    (new Extend\ApiResource(Resource\UserResource::class))
        ->fields(fn () => [
            Schema\Arr::make('framioActivity')
                ->nullable()
                ->visible(fn (User $user, Context $context) => $context->showing(Resource\UserResource::class))
                ->get(fn (User $user, Context $context) => resolve(Activity\ActivityResolver::class)->forUser($user, $context->getActor())),
        ]),
];
