<?php

namespace Framio\Engagement\WhoRead\Api\Resource;

use Flarum\Api\Context;
use Tobyz\JsonApiServer\Context as JsonApiContext;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Discussion\UserState;

/**
 * Exposes Flarum\Discussion\UserState rows (the "discussion_user" pivot,
 * which already tracks last-read position per user/discussion) as a
 * "clarkwinkelmann-who-readers" JSON:API resource, so the who-read
 * extension can list them as the discussion's `clarkwinkelmannWhoReaders`
 * relationship (see the field added to DiscussionResource in extend.php).
 *
 * @extends AbstractDatabaseResource<UserState>
 */
class WhoReaderResource extends AbstractDatabaseResource
{
    public function type(): string
    {
        return 'clarkwinkelmann-who-readers';
    }

    public function model(): string
    {
        return UserState::class;
    }

    /**
     * UserState has no surrogate id column (its primary key is the
     * composite user_id+discussion_id on discussion_user), so build one.
     */
    public function getId(object $model, JsonApiContext $context): string
    {
        return $model->user_id.'-'.$model->discussion_id;
    }

    /**
     * Never listed/shown/created/etc. through its own endpoint — this
     * resource only ever appears embedded as a discussion's relationship.
     */
    public function endpoints(): array
    {
        return [];
    }

    public function fields(): array
    {
        return [
            Schema\DateTime::make('lastReadAt')
                ->get(fn (UserState $state) => $state->last_read_at),
            Schema\Integer::make('lastReadPostNumber')
                ->get(fn (UserState $state) => $state->last_read_post_number),
            Schema\Str::make('subscription')
                ->get(function (UserState $state, Context $context) {
                    return $context->getActor()->hasPermission('who-read.seeSubscription')
                        ? $state->subscription
                        : null;
                }),
            Schema\Boolean::make('unread')
                ->get(function (UserState $state, Context $context) {
                    if (! $context->getActor()->hasPermission('who-read.seeUnread')) {
                        return null;
                    }

                    return (bool) $state->who_read_unread;
                }),

            Schema\Relationship\ToOne::make('user')
                ->get(fn (UserState $state) => $state->user)
                ->includable(),
        ];
    }
}
