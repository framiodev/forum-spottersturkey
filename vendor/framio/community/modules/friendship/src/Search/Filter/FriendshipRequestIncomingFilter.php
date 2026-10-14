<?php

declare(strict_types=1);

namespace forumaker\Friendship\Search\Filter;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\Search\ValidateFilterTrait;
use Flarum\User\Exception\PermissionDeniedException;

/**
 * filter[incoming]=<userId> — that user's incoming (received) requests.
 * Deliberately its own filter key rather than filter[user]+filter[direction]:
 * Filter classes only ever see their own key's value, not sibling filters',
 * so a "direction" filter would have no way to learn which user id the
 * accompanying "user" filter was for. Two self-contained keys (this one and
 * OutgoingFilter) sidestep that entirely.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class FriendshipRequestIncomingFilter implements FilterInterface
{
    use ValidateFilterTrait;

    public function getFilterKey(): string
    {
        return 'incoming';
    }

    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        // Same reasoning as FriendshipUserFilter — negation would turn a
        // single-user grant into "every incoming request except this
        // user's", leaking the whole table to a moderator scoped to one id.
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
        $state->getQuery()->where('recipient_id', $userId);
    }
}
