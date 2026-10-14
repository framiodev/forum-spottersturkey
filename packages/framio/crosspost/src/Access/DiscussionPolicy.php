<?php

namespace Framio\NetworkCrosspost\Access;

use Flarum\Discussion\Discussion;
use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;

class DiscussionPolicy extends AbstractPolicy
{
    public function crosspost(User $actor, Discussion $discussion): ?string
    {
        if ($actor->hasPermission('discussion.crosspost')) {
            return $this->allow();
        }

        return null;
    }
}
