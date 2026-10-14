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

namespace Framio\Moderation\ModeratorWarnings\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Framio\Moderation\ModeratorWarnings\Model\Warning;

class WarningPolicy extends AbstractPolicy
{
    public function edit(User $actor, Warning $warning): ?string
    {
        if ($actor->can('user.manageWarnings')) {
            return $this->allow();
        }

        return null;
    }

    public function delete(User $actor, Warning $warning): ?string
    {
        if ($actor->can('user.deleteWarnings')) {
            return $this->allow();
        }

        return null;
    }
}
