<?php

/*
 * This file is part of fof/move-posts.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\MovePosts\Exception;

use Exception;
use Flarum\Foundation\KnownError;

class MovePostsFromDifferentDiscussionsException extends Exception implements KnownError
{
    public function __construct()
    {
        parent::__construct('Cannot move posts from different discussions.');
    }

    public function getType(): string
    {
        return 'move_posts_from_different_discussions';
    }
}
