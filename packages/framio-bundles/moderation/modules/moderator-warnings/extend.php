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

namespace Framio\Moderation\ModeratorWarnings;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource;
use Flarum\Api\Schema;
use Flarum\Audit\Extend\Audit;
use Flarum\Extend;
use Flarum\Post\Post;
use Flarum\Search\Database\DatabaseSearchDriver;
use Flarum\User\User;
use Framio\Moderation\ModeratorWarnings\Access\UserPolicy;
use Framio\Moderation\ModeratorWarnings\Access\WarningPolicy;
use Framio\Moderation\ModeratorWarnings\Api\PostResourceFields;
use Framio\Moderation\ModeratorWarnings\Model\Warning;
use Framio\Moderation\ModeratorWarnings\Notification\WarningBlueprint;
use Framio\Moderation\ModeratorWarnings\Provider\WarningProvider;
use Framio\Moderation\ModeratorWarnings\Search\Filter\UserIdFilter;
use Framio\Moderation\ModeratorWarnings\Search\WarningSearcher;
use Illuminate\Database\Eloquent\Builder;

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/resources/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->css(__DIR__.'/resources/less/admin.less'),

    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\Model(Post::class))
        ->hasMany('warnings', Warning::class, 'post_id'),

    (new Extend\Model(User::class))
        ->hasMany('warnings', Warning::class, 'user_id'),

    (new Extend\View())
        ->namespace('fof-moderator-warnings', __DIR__.'/views'),

    (new Extend\Notification())
        ->type(WarningBlueprint::class, ['alert', 'email']),

    (new Extend\ApiResource(Resource\UserResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('canViewWarnings')
                ->get(fn (User $user, Context $context) => $context->getActor()->can('viewWarnings', $user)),
            Schema\Boolean::make('canManageWarnings')
                ->get(fn (User $user, Context $context) => $context->getActor()->can('user.manageWarnings')),
            Schema\Boolean::make('canDeleteWarnings')
                ->get(fn (User $user, Context $context) => $context->getActor()->can('user.deleteWarnings')),
            Schema\Integer::make('visibleWarningCount')
                // Batched into one aggregate query for all serialized users,
                // instead of one COUNT query per user.
                ->countRelation('warnings', function (Builder $query) {
                    $query->whereNull('hidden_at');
                }),
        ]),

    (new Extend\ApiResource(Resource\PostResource::class))
        ->fields(PostResourceFields::class)
        ->endpoint([Endpoint\Index::class, Endpoint\Show::class], function (Endpoint\Index|Endpoint\Show $endpoint) {
            // Eager-load the warnings' own relations alongside the include:
            // without this each warning loads its users (and their groups)
            // individually while being serialized.
            return $endpoint
                ->addDefaultInclude(['warnings', 'warnings.warnedUser', 'warnings.addedByUser'])
                ->eagerLoadWhenIncluded([
                    'warnings' => ['warnings.warnedUser', 'warnings.addedByUser'],
                ]);
        }),

    (new Extend\Policy())
        ->modelPolicy(User::class, UserPolicy::class)
        ->modelPolicy(Warning::class, WarningPolicy::class),

    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addSearcher(Warning::class, WarningSearcher::class)
        ->addFilter(WarningSearcher::class, UserIdFilter::class),

    (new Extend\ServiceProvider())
        ->register(WarningProvider::class),

    new Extend\ApiResource(Api\Resource\WarningResource::class),

    // Optional flarum/audit integration. The Conditional makes this a no-op unless the
    // audit extension is enabled, so flarum/audit stays a dev-only dependency.
    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-audit', function () {
            // Audit's frontend resolves {username}, {post} and {discussion} from the
            // user_id / post_id / discussion_id keys, so the payload uses those names.
            // The public and private comments are deliberately never logged: they're
            // moderator-authored free text, and the audit log has a wider audience
            // than the warning itself.
            $payload = function (Warning $warning): array {
                return [
                    'warning_id' => $warning->id,
                    'user_id' => $warning->user_id,
                    'post_id' => $warning->post_id,
                    'discussion_id' => $warning->post?->discussion_id,
                    'strikes' => $warning->strikes,
                ];
            };

            return [
                (new Audit())
                    ->group('fof-moderator-warnings')
                    ->listen(Event\WarningWasCreated::class, 'warning.created', fn (Event\WarningWasCreated $e) => $payload($e->warning))
                    ->listen(Event\WarningWasHidden::class, 'warning.hidden', fn (Event\WarningWasHidden $e) => $payload($e->warning))
                    ->listen(Event\WarningWasRestored::class, 'warning.restored', fn (Event\WarningWasRestored $e) => $payload($e->warning))
                    ->listen(Event\WarningWasDeleted::class, 'warning.deleted', fn (Event\WarningWasDeleted $e) => $payload($e->warning)),
            ];
        }),
];
