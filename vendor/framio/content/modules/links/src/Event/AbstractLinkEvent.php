<?php

/*
 * This file is part of fof/links.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Framio\Content\Links\Event;

use Flarum\User\User;
use Framio\Content\Links\Link;

abstract class AbstractLinkEvent
{
    public function __construct(public Link $link, public User $actor, public array $data)
    {
    }
}

