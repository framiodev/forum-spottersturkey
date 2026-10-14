<?php

/*
 * This file is part of fof/move-posts.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\MovePosts\Command;

use Flarum\User\User;

class MovePosts
{
    public function __construct(
        public User $actor,
        public array $data,
        public bool $emulate
    ) {
    }
}
