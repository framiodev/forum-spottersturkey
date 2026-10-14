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

namespace Framio\Moderation\ModeratorWarnings\Search;

use Flarum\Search\Database\AbstractSearcher;
use Flarum\User\User;
use Framio\Moderation\ModeratorWarnings\Model\Warning;
use Illuminate\Database\Eloquent\Builder;

class WarningSearcher extends AbstractSearcher
{
    public function getQuery(User $actor): Builder
    {
        return Warning::whereVisibleTo($actor)->select('warnings.*');
    }
}
