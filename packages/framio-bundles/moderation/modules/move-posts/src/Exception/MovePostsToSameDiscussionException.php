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

class MovePostsToSameDiscussionException extends Exception implements KnownError {
    public function __construct() {
        parent::__construct( 'Cannot move posts to the same discussion.' );
    }

    public function getType(): string {
        return 'move_posts_to_same_discussion';
    }
}
