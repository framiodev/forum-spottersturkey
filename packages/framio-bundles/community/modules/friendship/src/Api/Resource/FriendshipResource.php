<?php

declare(strict_types=1);

namespace forumaker\Friendship\Api\Resource;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\User\Exception\PermissionDeniedException;
use forumaker\Friendship\Friendship;
use forumaker\Friendship\Support\FriendshipManager;
use Illuminate\Database\Eloquent\Builder;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * @extends AbstractDatabaseResource<Friendship>
 */
class FriendshipResource extends AbstractDatabaseResource
{
    public function __construct(protected FriendshipManager $manager)
    {
    }

    public function type(): string
    {
        return 'friendships';
    }

    public function model(): string
    {
        return Friendship::class;
    }

    /**
     * The actual permission check + row restriction live in
     * Search\Filter\FriendshipUserFilter (Index requests go through
     * Flarum's SearchManager, which discards whatever query scope() builds
     * — see that filter's docblock). All scope() does is reject an Index
     * request with no filter[user] at all, so a bare `GET /friendships`
     * can't leak every friendship on the forum. It's a no-op for
     * Show/Delete (a specific row by id), which is governed by
     * FriendshipPolicy instead — restricting those here unconditionally
     * would 404 a perfectly authorized DELETE /friendships/{id} (no
     * filter[user] on that request at all).
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
                ->paginate(50, 100)
                ->defaultInclude(['friend'])
                ->defaultSort('-createdAt')
                ->eagerLoad(['friend']),
            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete')
                ->action(function (Context $context) {
                    $this->manager->removeFriend($context->getActor(), $context->model);
                }),
        ];
    }

    public function fields(): array
    {
        return [
            Schema\DateTime::make('createdAt')
                ->property('created_at'),
            Schema\Relationship\ToOne::make('user')
                ->type('users')
                ->includable(),
            Schema\Relationship\ToOne::make('friend')
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
