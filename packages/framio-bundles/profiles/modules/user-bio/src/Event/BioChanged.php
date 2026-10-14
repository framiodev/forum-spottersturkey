<?php

/*
 * This file is part of fof/user-bio.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Framio\Profiles\UserBio\Event;

use Flarum\User\User;

class BioChanged
{
    public function __construct(public User $user, public ?User $actor = null)
    {
    }
}
