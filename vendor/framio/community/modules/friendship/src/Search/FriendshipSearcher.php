<?php

declare(strict_types=1);

namespace forumaker\Friendship\Search;

use Flarum\Search\Database\AbstractSearcher;
use Flarum\User\User;
use forumaker\Friendship\Friendship;
use Illuminate\Database\Eloquent\Builder;

/**
 * Unrestricted here — permission check and row restriction both live in
 * Filter\FriendshipUserFilter, the only filter this resource's Index ever
 * receives (see FriendshipResource's scope() for why a bare, filterless
 * request is rejected before it ever reaches this searcher).
 */
class FriendshipSearcher extends AbstractSearcher
{
    public function getQuery(User $actor): Builder
    {
        return Friendship::query();
    }
}
