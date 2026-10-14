<?php

declare(strict_types=1);

namespace forumaker\Friendship\Search;

use Flarum\Search\Database\AbstractSearcher;
use Flarum\User\User;
use forumaker\Friendship\FriendshipEvent;
use Illuminate\Database\Eloquent\Builder;

/**
 * Unrestricted here — permission check and row restriction both live in
 * Filter\FriendshipEventUserFilter, the only filter this resource's Index
 * ever receives.
 */
class FriendshipEventSearcher extends AbstractSearcher
{
    public function getQuery(User $actor): Builder
    {
        return FriendshipEvent::query();
    }
}
