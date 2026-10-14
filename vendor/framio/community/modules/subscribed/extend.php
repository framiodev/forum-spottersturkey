<?php

/*
 * This file is part of fof/subscribed.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Framio\Community\Subscribed;

use Flarum\Api\Resource;
use Flarum\Extend;
use Framio\Community\Subscribed\Api\UserResourceFields;
use Framio\Community\Subscribed\Blueprints;

return [
    (new Extend\Frontend('forum')),

    (new Extend\Frontend('admin')),

    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\View())
        ->namespace('fof-subscribed', __DIR__.'/resources/views'),

    (new Extend\Notification())
        ->type(Blueprints\DiscussionCreatedBlueprint::class, [])
        ->type(Blueprints\PostCreatedBlueprint::class, [])
        ->type(Blueprints\PostUnapprovedBlueprint::class, [])
        ->type(Blueprints\UserCreatedBlueprint::class, [])
        ->type(Blueprints\PostFlaggedBlueprint::class, []),

    (new Extend\ApiResource(Resource\UserResource::class))
        ->fields(UserResourceFields::class),

    (new Extend\Event())
        ->subscribe(Listeners\DiscussionCreated::class)
        ->subscribe(Listeners\PostCreated::class)
        ->subscribe(Listeners\UnapprovedPostCreated::class)
        ->subscribe(Listeners\UserCreated::class)
        ->subscribe(Listeners\PostWasFlagged::class),
];
