<?php

declare(strict_types=1);

namespace forumaker\Friendship\Api\Resource;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\User\Exception\PermissionDeniedException;
use forumaker\Friendship\FriendshipRequest;
use forumaker\Friendship\Support\FriendshipManager;
use Illuminate\Database\Eloquent\Builder;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * @extends AbstractDatabaseResource<FriendshipRequest>
 *
 * Read (Index) and cancel (Delete) only. Sending, accepting and declining
 * requests go through dedicated controllers (see extend.php's custom
 * routes) since they need to run FriendshipManager's notification/history
 * side effects and, for sending, the mutual-request auto-accept path —
 * none of which fits a plain JSON:API create/delete action cleanly.
 */
class FriendshipRequestResource extends AbstractDatabaseResource
{
    public function __construct(protected FriendshipManager $manager)
    {
    }

    public function type(): string
    {
        return 'friendship-requests';
    }

    public function model(): string
    {
        return FriendshipRequest::class;
    }

    /**
     * The actual permission check + row restriction live in
     * Search\Filter\FriendshipRequestIncomingFilter / OutgoingFilter (Index
     * requests go through Flarum's SearchManager, which discards whatever
     * query scope() builds — see those filters' docblocks). All scope()
     * does is reject an Index request with neither filter key present, so
     * a bare `GET /friendship-requests` can't leak every request on the
     * forum. It's a no-op for Delete (cancelling a specific request by id),
     * which is governed by FriendshipRequestPolicy instead.
     */
    public function scope(Builder $query, OriginalContext $context): void
    {
        if (! $context->endpoint instanceof Endpoint\Index) {
            return;
        }

        $filter = (array) $context->queryParam('filter', []);

        if (! isset($filter['incoming']) && ! isset($filter['outgoing'])) {
            throw new PermissionDeniedException();
        }
    }

    public function endpoints(): array
    {
        return [
            Endpoint\Index::make()
                ->authenticated()
                ->paginate(50, 100)
                ->defaultInclude(['sender', 'recipient'])
                ->defaultSort('-createdAt')
                ->eagerLoad(['sender', 'recipient']),
            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete')
                ->action(function (Context $context) {
                    $this->manager->cancelRequest($context->getActor(), $context->model);
                }),
        ];
    }

    public function fields(): array
    {
        return [
            Schema\DateTime::make('createdAt')
                ->property('created_at'),
            Schema\Relationship\ToOne::make('sender')
                ->type('users')
                ->includable(),
            Schema\Relationship\ToOne::make('recipient')
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
