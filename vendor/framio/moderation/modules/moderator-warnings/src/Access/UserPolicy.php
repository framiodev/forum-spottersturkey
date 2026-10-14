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

class UserPolicy extends AbstractPolicy
{
    public function can(User $actor, string $ability, User|string $user): ?string
    {
        if ($ability === 'user.viewWarnings' || $ability === 'viewWarnings') {
            // Users with viewWarnings permission can view any user's warnings
            if ($actor->hasPermission('user.viewWarnings')) {
                return $this->allow();
            }

            // Users can always view their own warnings
            if ($user instanceof User && $actor->id == $user->id) {
                return $this->allow();
            }

            // Explicitly deny if trying to view another user's warnings
            return $this->deny();
        }

        return null;
    }
}
