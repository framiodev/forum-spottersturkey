<?php

declare(strict_types=1);

namespace forumaker\Friendship\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use forumaker\Friendship\FriendshipRequest;

class FriendshipRequestPolicy extends AbstractPolicy
{
    public function view(User $actor, FriendshipRequest $request): ?string
    {
        if ($actor->id === $request->sender_id || $actor->id === $request->recipient_id) {
            return $this->allow();
        }

        if ($actor->hasPermission('friendship.moderate') || $actor->hasPermission('friendship.manage')) {
            return $this->allow();
        }

        return null;
    }

    /**
     * Covers cancelling (by the sender) — declining is handled by the
     * dedicated accept/decline controllers, not the JSON:API delete
     * endpoint, since it needs to fire a notification the plain delete
     * doesn't.
     */
    public function delete(User $actor, FriendshipRequest $request): ?string
    {
        if ($actor->id === $request->sender_id) {
            return $this->allow();
        }

        if ($actor->hasPermission('friendship.moderate') || $actor->hasPermission('friendship.manage')) {
            return $this->allow();
        }

        return null;
    }
}
