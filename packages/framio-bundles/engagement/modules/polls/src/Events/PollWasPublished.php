<?php

/*
 * This file is part of fof/polls.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Framio\Engagement\Polls\Events;

use Flarum\User\User;
use Framio\Engagement\Polls\Poll;

class PollWasPublished
{
    public function __construct(public Poll $poll, public ?User $actor = null)
    {
    }
}
