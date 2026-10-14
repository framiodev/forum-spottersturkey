<?php

namespace Framio\Profiles\UserMap;

use Flarum\Api\Resource\UserResource;
use Flarum\Extend;
use Flarum\User\Event\Saving;
use Flarum\User\User;

return [
    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/resources/less/forum.less')
        ->route('/map', 'members.map'),

    (new Extend\Model(User::class))
        ->cast('location', 'string')
        ->cast('map_lat', 'float')
        ->cast('map_lon', 'float'),

    (new Extend\Event())
        ->listen(Saving::class, Listeners\SaveLocationToDatabase::class),

    (new Extend\ApiResource(UserResource::class))
        ->fields(Api\UserMapResourceFields::class),

    (new Extend\Routes('api'))
        ->get('/map-users', 'map-users.index', Api\ListMapUsersController::class),

    (new Extend\Settings())
        ->default('framio-profiles.user-map.mapHeight', 500)
        ->default('framio-profiles.user-map.fullWidth', false)
        ->default('framio-profiles.user-map.useMasquerade', true)
        ->serializeToForum('framioProfilesMap.mapHeight', 'framio-profiles.user-map.mapHeight', 'intval')
        ->serializeToForum('framioProfilesMap.fullWidth', 'framio-profiles.user-map.fullWidth', 'boolval')
        ->serializeToForum('framioProfilesMap.useMasquerade', 'framio-profiles.user-map.useMasquerade', 'boolval'),
];
