<?php

/*
 * This file is part of fof/polls.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Framio\Engagement\Polls\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Framio\Engagement\Polls\PollGroup;

class PollGroupPolicy extends AbstractPolicy
{
    public function edit(User $user, PollGroup $pollGroup): string|bool|null
    {
        return $user->id === $pollGroup->user_id || $user->hasPermission('polls.moderate_group');
    }

    public function delete(User $user, PollGroup $pollGroup): string|bool|null
    {
        return $user->id === $pollGroup->user_id || $user->hasPermission('polls.moderate_group');
    }
}
