<?php

/*
 * This file is part of fof/moderator-warnings
 *
 * Copyright (c) Alexander Skvortsov.
 * Copyright (c) FriendsOfFlarum
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

namespace Framio\Moderation\ModeratorWarnings\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Post\Post;

class PostResourceFields
{
    public function __invoke(): array
    {
        return [
            Schema\Relationship\ToMany::make('warnings')
                ->type('warnings')
                ->includable()
                // No `get()` callback: that would load the relationship per
                // post, and since this is a default include on the posts
                // endpoints it meant one query per post on every page. Left to
                // the relationship loader, all posts on the page are batched
                // into one query.
                ->scope(function ($query, Context $context) {
                    $query->whereVisibleTo($context->getActor());
                })
                // Whether warnings may be seen at all depends on the post's
                // author, so it is decided per post rather than in the query.
                // Both checks are deliberately cheap: the global permission is
                // resolved once for the actor, and authorship is compared by
                // foreign key so the author (and their groups) are never
                // loaded on behalf of this field.
                ->visible(function (Post $post, Context $context) {
                    $actor = $context->getActor();

                    return $actor->id === $post->user_id || $actor->hasPermission('user.viewWarnings');
                }),
        ];
    }
}
