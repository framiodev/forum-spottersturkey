<?php

/*
 * This file is part of fof/moderator-warnings
 *
 * Copyright (c) Alexander Skvortsov.
 * Copyright (c) FriendsOfFlarum
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

namespace Framio\Moderation\ModeratorWarnings\Api\Resource;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\Notification\NotificationSyncer;
use Flarum\Post\Post;
use Framio\Moderation\ModeratorWarnings\Event\WarningWasCreated;
use Framio\Moderation\ModeratorWarnings\Event\WarningWasDeleted;
use Framio\Moderation\ModeratorWarnings\Model\Warning;
use Framio\Moderation\ModeratorWarnings\Notification\WarningBlueprint;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * @extends Resource\AbstractDatabaseResource<Warning>
 */
class WarningResource extends Resource\AbstractDatabaseResource
{
    public function __construct(
        protected NotificationSyncer $notifications
    ) {
    }

    public function type(): string
    {
        return 'warnings';
    }

    public function model(): string
    {
        return Warning::class;
    }

    public function scope(Builder $query, \Tobyz\JsonApiServer\Context $context): void
    {
        // Apply visibility scoping first
        $query->whereVisibleTo($context->getActor());

        // Handle userId filter with permission check
        $filters = $context->request->getQueryParams()['filter'] ?? [];

        if (isset($filters['userId'])) {
            $userId = (int) $filters['userId'];
            $targetUser = \Flarum\User\User::find($userId);

            if ($targetUser) {
                // Verify actor has permission to view this user's warnings
                $context->getActor()->assertCan('user.viewWarnings', $targetUser);
                $query->where('user_id', $userId);
            }
        }
    }

    public function endpoints(): array
    {
        return [
            // The same default includes as Show: the frontend inserts the created warning
            // straight into the list and the post footer, so the response has to carry
            // everything those views render.
            Endpoint\Create::make()
                ->authenticated()
                ->can('user.manageWarnings')
                ->addDefaultInclude(['addedByUser', 'post', 'post.discussion']),
            Endpoint\Show::make()
                ->addDefaultInclude(['addedByUser', 'post', 'post.discussion']),
            Endpoint\Update::make()
                ->authenticated()
                ->can('edit'),
            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete'),
            Endpoint\Index::make()
                ->addDefaultInclude(['addedByUser', 'post', 'post.discussion'])
                ->paginate(),
        ];
    }

    public function fields(): array
    {
        return [
            Schema\Integer::make('userId')
                ->requiredOnCreate()
                ->writable(fn (Warning $warning, Context $context) => $context->getActor()->can('user.manageWarnings'))
                ->set(function (Warning $warning, int $value) {
                    $warning->user_id = $value;
                }),

            Schema\Str::make('publicComment')
                ->requiredOnCreate()
                ->writable(fn (Warning $warning, Context $context) => $context->getActor()->can('user.manageWarnings'))
                ->get(fn (Warning $warning) => Warning::getFormatter()->render($warning->public_comment, new \Flarum\Post\Post()))
                ->set(function (Warning $warning, string $value) {
                    $warning->public_comment = Warning::getFormatter()->parse($value, new \Flarum\Post\Post());
                }),

            Schema\Str::make('privateComment')
                ->nullable()
                ->writable(fn (Warning $warning, Context $context) => $context->getActor()->can('user.manageWarnings'))
                ->visible(fn (Warning $warning, Context $context) => $context->getActor()->can('user.manageWarnings'))
                ->get(fn (Warning $warning) => $warning->private_comment ? Warning::getFormatter()->render($warning->private_comment, new \Flarum\Post\Post()) : null)
                ->set(function (Warning $warning, ?string $value) {
                    $warning->private_comment = $value ? Warning::getFormatter()->parse($value, new \Flarum\Post\Post()) : null;
                }),

            Schema\Integer::make('strikes')
                ->min(0)
                ->max(5)
                ->default(0)
                ->writable(fn (Warning $warning, Context $context) => $context->getActor()->can('user.manageWarnings'))
                ->set(function (Warning $warning, int $value) {
                    $warning->strikes = $value;
                }),

            Schema\DateTime::make('createdAt')
                ->property('created_at'),

            // Mirrors core's Post and Discussion resources: `isHidden` is the writable
            // attribute, delegating to the model's hide()/restore(), while `hiddenAt` is
            // read-only and only serialized once the warning is actually hidden. Writable
            // only when updating, so a warning can't be created pre-hidden.
            Schema\Boolean::make('isHidden')
                ->get(fn (Warning $warning) => $warning->hidden_at !== null)
                ->writable(fn (Warning $warning, Context $context) => $context->updating()
                    && $context->getActor()->can('user.manageWarnings'))
                ->set(function (Warning $warning, bool $value, Context $context) {
                    if ($value) {
                        $warning->hide($context->getActor());
                    } else {
                        $warning->restore();
                    }
                }),

            Schema\DateTime::make('hiddenAt')
                ->visible(fn (Warning $warning) => $warning->hidden_at !== null),

            Schema\Relationship\ToOne::make('warnedUser')
                ->includable()
                ->type('users'),

            Schema\Relationship\ToOne::make('addedByUser')
                ->includable()
                ->type('users'),

            Schema\Relationship\ToOne::make('hiddenByUser')
                ->includable()
                ->nullable()
                ->type('users'),

            Schema\Relationship\ToOne::make('post')
                ->includable()
                ->nullable()
                ->type('posts')
                ->writable(fn (Warning $warning, Context $context) => $context->getActor()->can('user.manageWarnings'))
                ->set(function (Warning $warning, ?Post $post) {
                    $warning->post_id = $post?->id;
                }),
        ];
    }

    public function sorts(): array
    {
        return [
            SortColumn::make('createdAt')
                ->ascendingAlias('oldest')
                ->descendingAlias('newest'),
        ];
    }

    public function defaultSort(): array
    {
        return ['-createdAt'];
    }

    public function creating(object $model, \Tobyz\JsonApiServer\Context $context): ?object
    {
        /** @var Warning $model */
        $model->created_user_id = $context->getActor()->id;
        $model->created_at = Carbon::now();

        return $model;
    }

    public function created(object $model, \Tobyz\JsonApiServer\Context $context): ?object
    {
        /** @var Warning $model */
        $this->notifications->sync(new WarningBlueprint($model), [$model->warnedUser]);

        // Released by the framework after this hook, with the actor filled in.
        $model->raise(new WarningWasCreated($model));

        return $model;
    }

    public function updated(object $model, \Tobyz\JsonApiServer\Context $context): ?object
    {
        /** @var Warning $model */
        // Only handle notification changes if hidden_at was modified
        if ($model->wasChanged('hidden_at')) {
            // If warning is now hidden, clear notifications
            // If warning is now unhidden, send notifications
            if ($model->hidden_at !== null) {
                $this->notifications->sync(new WarningBlueprint($model), []);
            } else {
                $this->notifications->sync(new WarningBlueprint($model), [$model->warnedUser]);
            }
        }

        return $model;
    }

    public function deleting(object $model, \Tobyz\JsonApiServer\Context $context): void
    {
        /** @var Warning $model */
        $this->notifications->sync(new WarningBlueprint($model), []);

        // Raised pre-delete, released by the framework once the row is gone; the
        // in-memory model keeps its attributes for listeners.
        $model->raise(new WarningWasDeleted($model));
    }
}
