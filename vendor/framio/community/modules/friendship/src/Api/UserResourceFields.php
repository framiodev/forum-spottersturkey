<?php

declare(strict_types=1);

namespace forumaker\Friendship\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use forumaker\Friendship\Support\FriendshipActorContext;

class UserResourceFields
{
    public function __construct(protected FriendshipActorContext $actorContext)
    {
    }

    public function __invoke(): array
    {
        return [
            // countRelation batches this through Flarum's EloquentBuffer —
            // one query for every user on the page, not one per user — see
            // the 'friendships' relation registered on User in extend.php.
            Schema\Integer::make('friendCount')
                ->countRelation('friendships'),
            // Drives the count on the "Requests" button on the friends page
            // (FriendsPage.tsx) — not actor-relative, just this user's own
            // pending inbox, same N+1-safe batching as friendCount above.
            Schema\Integer::make('friendshipIncomingRequestCount')
                ->countRelation('friendshipIncomingRequests'),
            // These three are actor-relative (not just about $user), so
            // they can't use countRelation — see FriendshipActorContext's
            // docblock for how they stay N+1-safe instead.
            Schema\Boolean::make('friendshipIsFriend')
                ->get(function ($user, Context $context) {
                    $actor = $context->getActor();
                    if ($actor->id === $user->id) {
                        return false;
                    }

                    return in_array($user->id, $this->actorContext->forActor($actor)['friends'], true);
                }),
            Schema\Boolean::make('friendshipHasPendingOutgoing')
                ->get(function ($user, Context $context) {
                    $actor = $context->getActor();
                    if ($actor->id === $user->id) {
                        return false;
                    }

                    return in_array($user->id, $this->actorContext->forActor($actor)['outgoing'], true);
                }),
            Schema\Boolean::make('friendshipHasPendingIncoming')
                ->get(function ($user, Context $context) {
                    $actor = $context->getActor();
                    if ($actor->id === $user->id) {
                        return false;
                    }

                    return in_array($user->id, $this->actorContext->forActor($actor)['incoming'], true);
                }),
            // The pending request's id when $user already sent the actor
            // one — lets the "already requested you" confirm modal
            // accept/decline it directly, with no extra lookup round trip.
            Schema\Integer::make('friendshipPendingIncomingRequestId')
                ->get(function ($user, Context $context) {
                    $actor = $context->getActor();
                    if ($actor->id === $user->id) {
                        return null;
                    }

                    return $this->actorContext->forActor($actor)['incomingRequestIds'][$user->id] ?? null;
                })
                ->nullable(),
            // The actor's own pending request's id when they're the one
            // who sent $user one — lets the "cancel request" confirm modal
            // act on it directly.
            Schema\Integer::make('friendshipPendingOutgoingRequestId')
                ->get(function ($user, Context $context) {
                    $actor = $context->getActor();
                    if ($actor->id === $user->id) {
                        return null;
                    }

                    return $this->actorContext->forActor($actor)['outgoingRequestIds'][$user->id] ?? null;
                })
                ->nullable(),
            // Per-user opt-outs for the two badges — combined with the
            // admin-wide toggles in ForumResourceFields on the frontend (see
            // addFriendBadgeToUserCard.tsx / addFriendBadgeToPost.tsx).
            Schema\Boolean::make('friendshipShowOnUserCard')
                ->get(fn ($user) => (bool) ($user->getPreference('friendshipShowOnUserCard') ?? true)),
            Schema\Boolean::make('friendshipShowInPosts')
                ->get(fn ($user) => (bool) ($user->getPreference('friendshipShowInPosts') ?? true)),
        ];
    }
}
