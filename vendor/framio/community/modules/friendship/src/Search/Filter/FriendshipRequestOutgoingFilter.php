<?php

declare(strict_types=1);

namespace forumaker\Friendship\Search\Filter;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\Search\ValidateFilterTrait;
use Flarum\User\Exception\PermissionDeniedException;

/**
 * filter[outgoing]=<userId> — that user's outgoing (sent) requests. See
 * FriendshipRequestIncomingFilter's docblock for why this is a separate
 * filter key rather than filter[user]+filter[direction].
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class FriendshipRequestOutgoingFilter implements FilterInterface
{
    use ValidateFilterTrait;

    public function getFilterKey(): string
    {
        return 'outgoing';
    }

    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        // Same reasoning as FriendshipUserFilter — negation would turn a
        // single-user grant into "every outgoing request except this
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
        $state->getQuery()->where('sender_id', $userId);
    }
}
