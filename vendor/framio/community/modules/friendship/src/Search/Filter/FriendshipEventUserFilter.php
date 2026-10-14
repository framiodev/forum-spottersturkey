<?php

declare(strict_types=1);

namespace forumaker\Friendship\Search\Filter;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\Search\ValidateFilterTrait;
use Flarum\User\Exception\PermissionDeniedException;

/**
 * filter[user]=<userId> on /api/friendship-events — that user's history.
 * Viewing your own is always allowed; viewing someone else's needs
 * friendship.moderate (or manage) — stricter than FriendshipUserFilter,
 * since viewOthers only covers the plain friends list, not requests/history
 * (see the permission descriptions in extend.php's admin registration).
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class FriendshipEventUserFilter implements FilterInterface
{
    use ValidateFilterTrait;

    public function getFilterKey(): string
    {
        return 'user';
    }

    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        // Same reasoning as FriendshipUserFilter — negation would turn a
        // single-user grant into "every event except this user's", leaking
        // the whole history table to a moderator scoped to one id.
        if ($negate) {
            throw new PermissionDeniedException();
        }

        $userId = $this->asInt($value);
        $actor = $state->getActor();

        if ($userId !== $actor->id
            && ! $actor->hasPermission('friendship.moderate')
            && ! $actor->hasPermission('friendship.manage')
        ) {
            throw new PermissionDeniedException();
        }

        /** @var DatabaseSearchState $state */
        $state->getQuery()->where('user_id', $userId);
    }
}
