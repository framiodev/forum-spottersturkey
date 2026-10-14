<?php

declare(strict_types=1);

namespace forumaker\Friendship\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use forumaker\Friendship\Friendship;

class FriendshipPolicy extends AbstractPolicy
{
    public function view(User $actor, Friendship $friendship): ?string
    {
        if ($actor->id === $friendship->user_id) {
            return $this->allow();
        }

        if ($actor->hasPermission('friendship.viewOthers')
            || $actor->hasPermission('friendship.moderate')
            || $actor->hasPermission('friendship.manage')
        ) {
            return $this->allow();
        }

        return null;
    }

    public function delete(User $actor, Friendship $friendship): ?string
    {
        if ($actor->id === $friendship->user_id || $actor->id === $friendship->friend_id) {
            return $this->allow();
        }

        if ($actor->hasPermission('friendship.moderate') || $actor->hasPermission('friendship.manage')) {
            return $this->allow();
        }

        return null;
    }
}
