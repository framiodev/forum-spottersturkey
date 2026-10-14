<?php

/*
 * This file is part of fof/top-posters-widget.
 *
 * Copyright (c) 2021 FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\TopPosters\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use FoF\TopPosters\AddTopPostersToApi;
use FoF\TopPosters\LoadForumTopPostersRelationship;

class ForumResourceFields
{
    public function __construct(
        protected AddTopPostersToApi $addTopPosters,
        protected LoadForumTopPostersRelationship $loadTopPosters,
    ) {}

    public function __invoke(): array
    {
        return [
            Schema\Arr::make('fof-top-posters-widget.topPosterCounts')
                ->get(fn () => ($this->addTopPosters)()),
            Schema\Relationship\ToMany::make('topPosters')
                ->type('users')
                ->includable()
                ->get(fn (mixed $model, Context $context) => ($this->loadTopPosters)($model, $context)),
        ];
    }
}
