<?php

declare(strict_types=1);

namespace forumaker\Friendship\Api\Resource;

use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\User\Exception\PermissionDeniedException;
use forumaker\Friendship\FriendshipEvent;
use Illuminate\Database\Eloquent\Builder;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * @extends AbstractDatabaseResource<FriendshipEvent>
 *
 * Read-only history feed. Viewing someone else's history requires
 * friendship.moderate/manage — unlike the friends list itself, which only
 * needs friendship.viewOthers (see FriendshipResource).
 */
class FriendshipEventResource extends AbstractDatabaseResource
{
    public function type(): string
    {
        return 'friendship-events';
    }

    public function model(): string
    {
        return FriendshipEvent::class;
    }

    /**
     * The actual permission check + row restriction live in
     * Search\Filter\FriendshipEventUserFilter — see FriendshipResource's
     * scope() docblock for why this is a bare filter-presence guard rather
     * than a real restriction.
     */
    public function scope(Builder $query, OriginalContext $context): void
    {
        if (! $context->endpoint instanceof Endpoint\Index) {
            return;
        }

        if (! isset(((array) $context->queryParam('filter', []))['user'])) {
            throw new PermissionDeniedException();
        }
    }

    public function endpoints(): array
    {
        return [
            Endpoint\Index::make()
                ->authenticated()
                ->paginate(50, 100)
                ->defaultInclude(['otherUser', 'actor'])
                ->defaultSort('-createdAt')
                ->eagerLoad(['otherUser', 'actor']),
        ];
    }

    public function fields(): array
    {
        return [
            Schema\Str::make('action'),
            Schema\DateTime::make('createdAt')
                ->property('created_at'),
            Schema\Relationship\ToOne::make('otherUser')
                ->type('users')
                ->includable(),
            Schema\Relationship\ToOne::make('actor')
                ->type('users')
                ->includable(),
        ];
    }

    public function sorts(): array
    {
        return [
            SortColumn::make('createdAt')
                ->column('created_at'),
        ];
    }
}
