<?php

declare(strict_types=1);

namespace forumaker\Friendship\Search\Filter;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\Search\ValidateFilterTrait;
use Flarum\User\Exception\PermissionDeniedException;

/**
 * filter[user]=<userId> on /api/friendships — that user's friends list.
 * Viewing your own is always allowed; viewing someone else's needs
 * friendship.viewOthers (or moderate/manage).
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class FriendshipUserFilter implements FilterInterface
{
    use ValidateFilterTrait;

    public function getFilterKey(): string
    {
        return 'user';
    }

    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        // Negation has no valid meaning here — filter[user] grants access to
        // one specific user's friend list, not "everyone except this user"
        // (which would hand out the whole friendships table to anyone with
        // plain viewOthers).
        if ($negate) {
            throw new PermissionDeniedException();
        }

        $userId = $this->asInt($value);
        $actor = $state->getActor();

        if ($userId !== $actor->id
            && ! $actor->hasPermission('friendship.viewOthers')
            && ! $actor->hasPermission('friendship.moderate')
            && ! $actor->hasPermission('friendship.manage')
        ) {
            throw new PermissionDeniedException();
        }

        /** @var DatabaseSearchState $state */
        $state->getQuery()->where('user_id', $userId);
    }
}
