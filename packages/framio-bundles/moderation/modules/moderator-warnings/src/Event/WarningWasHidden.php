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

namespace Framio\Moderation\ModeratorWarnings\Event;

use Flarum\User\User;
use Framio\Moderation\ModeratorWarnings\Model\Warning;

/**
 * A warning was hidden, retracting it from the warned user.
 */
class WarningWasHidden
{
    public function __construct(
        public Warning $warning,
        public ?User $actor = null
    ) {
    }
}
