<?php

declare(strict_types=1);

namespace forumaker\Friendship\Search;

use Flarum\Search\Database\AbstractSearcher;
use Flarum\User\User;
use forumaker\Friendship\FriendshipRequest;
use Illuminate\Database\Eloquent\Builder;

/**
 * Deliberately unrestricted here — the actor/permission check and the
 * actual row restriction both live in Filter\FriendshipRequestIncomingFilter
 * / OutgoingFilter, since those are the only two filters ever sent and each
 * is self-contained (see their docblocks for why a single combined
 * user+direction filter pair doesn't work cleanly here).
 */
class FriendshipRequestSearcher extends AbstractSearcher
{
    public function getQuery(User $actor): Builder
    {
        return FriendshipRequest::query();
    }
}
