<?php

/*
 * This file is part of fof/top-posters-widget.
 *
 * Copyright (c) 2021 FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\TopPosters;

use Flarum\Api\Endpoint;
use Flarum\Api\Resource\ForumResource;
use Flarum\Extend;
use Flarum\Settings\Event\Saved;
use Flarum\User\Event\Saving as UserSaving;
use Flarum\User\Search\UserSearcher;
use FoF\TopPosters\Api\ForumResourceFields;

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->css(__DIR__.'/less/admin.less'),

    new Extend\Locales(__DIR__.'/locale'),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(ForumResourceFields::class)
        ->endpoint(Endpoint\Show::class, fn (Endpoint\Show $endpoint) => $endpoint
            ->addDefaultInclude(['topPosters'])),

    (new Extend\Settings())
        ->default('fof-top-posters-widget.excludeGroups', '[]'),

    (new Extend\Event())
        ->listen(Saved::class, Listener\ClearTopPosterCacheOnSettingsChange::class)
        ->listen(UserSaving::class, Listener\ClearTopPosterCacheOnSuspension::class),

    (new Extend\SearchDriver(\Flarum\Search\Database\DatabaseSearchDriver::class))
        ->addFilter(UserSearcher::class, Query\TopPosterFilter::class),
];
