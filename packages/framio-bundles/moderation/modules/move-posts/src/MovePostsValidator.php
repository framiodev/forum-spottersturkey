<?php

/*
 * This file is part of fof/move-posts.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\MovePosts;

use Flarum\Foundation\AbstractValidator;

class MovePostsValidator extends AbstractValidator
{
    protected array $rules = [
        'sourceDiscussionId' => 'required|integer',
        'postIds' => 'required|array',
        'postIds.*' => 'required|integer',
        'targetDiscussionId' => 'required_without:newDiscussion|integer',
        'newDiscussion' => 'sometimes',
        'newDiscussionTitle' => 'required_with:newDiscussion|string',
    ];
}
