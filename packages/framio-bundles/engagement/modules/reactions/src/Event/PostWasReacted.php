<?php

/*
 * This file is part of fof/reactions.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Framio\Engagement\Reactions\Event;

use Flarum\Post\Post;
use Flarum\User\User;
use Framio\Engagement\Reactions\PostAnonymousReaction;
use Framio\Engagement\Reactions\PostReaction;
use Framio\Engagement\Reactions\Reaction;

class PostWasReacted
{
    public function __construct(
        public Post $post,
        public PostReaction|PostAnonymousReaction $postReaction,
        public User $user,
        public Reaction $reaction,
        public bool $changed = false
    ) {
    }
}
