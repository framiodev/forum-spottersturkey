<?php

/*
 * This file is part of framio/community (friendship module).
 * Source: forumaker/friendship (MIT License)
 */

declare(strict_types=1);

namespace forumaker\Friendship;

use Flarum\Api\Resource;
use Flarum\Extend;
use Flarum\Search\Database\DatabaseSearchDriver;
use Flarum\User\User;

return [
    // Locale
    new Extend\Locales(__DIR__ . '/locale'),

    // Note: migrations are in packages/community/migrations/ (central)

    // API Resources
    new Extend\ApiResource(Api\Resource\FriendshipRequestResource::class),
    new Extend\ApiResource(Api\Resource\FriendshipResource::class),
    new Extend\ApiResource(Api\Resource\FriendshipEventResource::class),

    // Search drivers
    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addSearcher(FriendshipRequest::class, Search\FriendshipRequestSearcher::class)
        ->addFilter(Search\FriendshipRequestSearcher::class, Search\Filter\FriendshipRequestIncomingFilter::class)
        ->addFilter(Search\FriendshipRequestSearcher::class, Search\Filter\FriendshipRequestOutgoingFilter::class)
        ->addFilter(Search\FriendshipRequestSearcher::class, Search\Filter\FriendshipRequestSearchFilter::class)
        ->addSearcher(Friendship::class, Search\FriendshipSearcher::class)
        ->addFilter(Search\FriendshipSearcher::class, Search\Filter\FriendshipUserFilter::class)
        ->addFilter(Search\FriendshipSearcher::class, Search\Filter\FriendshipSearchFilter::class)
        ->addSearcher(FriendshipEvent::class, Search\FriendshipEventSearcher::class)
        ->addFilter(Search\FriendshipEventSearcher::class, Search\Filter\FriendshipEventUserFilter::class),

    // Custom API endpoints
    (new Extend\Routes('api'))
        ->post('/friendship-requests', 'friendship-requests.send', Api\Controller\SendFriendRequestController::class)
        ->post('/friendship-requests/{id}/accept', 'friendship-requests.accept', Api\Controller\AcceptFriendRequestController::class)
        ->post('/friendship-requests/{id}/decline', 'friendship-requests.decline', Api\Controller\DeclineFriendRequestController::class)
        ->post('/friendships/remove', 'friendships.remove', Api\Controller\RemoveFriendController::class),

    // User model relationships
    (new Extend\Model(User::class))
        ->relationship('friendships', fn ($user) => $user->hasMany(Friendship::class, 'user_id'))
        ->relationship('friendshipEvents', fn ($user) => $user->hasMany(FriendshipEvent::class, 'user_id'))
        ->relationship('friendshipIncomingRequests', fn ($user) => $user->hasMany(FriendshipRequest::class, 'recipient_id')),

    // Per-user badge visibility preferences
    (new Extend\User())
        ->registerPreference('friendshipShowOnUserCard', 'boolval', true)
        ->registerPreference('friendshipShowInPosts', 'boolval', true),

    // Forum resource fields
    (new Extend\ApiResource(Resource\ForumResource::class))
        ->fields(Api\ForumResourceFields::class),

    // User resource fields
    (new Extend\ApiResource(Resource\UserResource::class))
        ->fields(Api\UserResourceFields::class),

    // Notifications
    (new Extend\Notification())
        ->type(Notification\FriendshipRequestedBlueprint::class, ['alert'])
        ->type(Notification\FriendshipRemovedBlueprint::class, ['alert'])
        ->type(Notification\FriendshipDeclinedBlueprint::class, ['alert']),

    // Settings defaults
    (new Extend\Settings())
        ->default('forumaker-friendship.show_badge_on_usercard', true)
        ->default('forumaker-friendship.show_badge_on_post', true)
        ->default('forumaker-friendship.badge_color', '#45698D')
        ->default('forumaker-friendship.badge_bg_color', '#45698D')
        ->default('forumaker-friendship.badge_icon', 'fas fa-hand-peace')
        ->default('forumaker-friendship.event_retention_days', 90),

    // Model policies
    (new Extend\Policy())
        ->modelPolicy(FriendshipRequest::class, Access\FriendshipRequestPolicy::class)
        ->modelPolicy(Friendship::class, Access\FriendshipPolicy::class)
        ->modelPolicy(FriendshipEvent::class, Access\FriendshipEventPolicy::class),

    // Console command for pruning old events
    (new Extend\Console())
        ->command(Console\PruneEventsCommand::class)
        ->schedule(Console\PruneEventsCommand::class, fn ($event) => $event->daily()),
];
