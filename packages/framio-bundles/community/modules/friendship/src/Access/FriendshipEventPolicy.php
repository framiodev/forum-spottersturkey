<?php

declare(strict_types=1);

namespace forumaker\Friendship\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use forumaker\Friendship\FriendshipEvent;

class FriendshipEventPolicy extends AbstractPolicy
{
    public function view(User $actor, FriendshipEvent $event): ?string
    {
        if ($actor->id === $event->user_id) {
            return $this->allow();
        }

        if ($actor->hasPermission('friendship.moderate') || $actor->hasPermission('friendship.manage')) {
            return $this->allow();
        }

        return null;
    }
}
