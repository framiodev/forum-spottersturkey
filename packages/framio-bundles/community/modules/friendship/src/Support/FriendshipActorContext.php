<?php

declare(strict_types=1);

namespace forumaker\Friendship\Support;

use Flarum\User\User;
use forumaker\Friendship\Friendship;
use forumaker\Friendship\FriendshipRequest;

/**
 * Per-actor, per-request cache of "who am I friends with / have I
 * requested / has requested me" id sets. UserResourceFields' isFriend and
 * pending-request flags are actor-relative, so they can't be batched via
 * Flarum's relation-count EloquentBuffer (that batches per target row, not
 * per actor) — instead, this fetches the actor's id sets once (four
 * queries total, however many users end up serialized in the response) and
 * every field lookup afterward is an in-memory lookup.
 *
 * Instance-level cache, not static: the container resolves one instance of
 * this class per request (injected into UserResourceFields, itself resolved
 * once per request and reused for every row), so the cache naturally clears
 * between requests. A static property would instead persist for the
 * lifetime of the PHP process under a long-running worker model (Octane,
 * FrankenPHP, RoadRunner), serving stale friendship state to later requests.
 */
class FriendshipActorContext
{
    /**
     * @var array<int, array{
     *     friends: array<int, int>,
     *     outgoing: array<int, int>,
     *     incoming: array<int, int>,
     *     incomingRequestIds: array<int, int>,
     *     outgoingRequestIds: array<int, int>,
     * }>
     */
    private array $cache = [];

    /**
     * @return array{
     *     friends: array<int, int>,
     *     outgoing: array<int, int>,
     *     incoming: array<int, int>,
     *     incomingRequestIds: array<int, int>,
     *     outgoingRequestIds: array<int, int>,
     * }
     */
    public function forActor(User $actor): array
    {
        if ($actor->isGuest()) {
            return ['friends' => [], 'outgoing' => [], 'incoming' => [], 'incomingRequestIds' => [], 'outgoingRequestIds' => []];
        }

        if (isset($this->cache[$actor->id])) {
            return $this->cache[$actor->id];
        }

        // otherUserId => requestId — lets the frontend act on a specific
        // request (accept/decline/cancel) without an extra round trip to
        // look its id up first.
        $incomingRequestIds = FriendshipRequest::where('recipient_id', $actor->id)
            ->pluck('id', 'sender_id')
            ->all();
        $outgoingRequestIds = FriendshipRequest::where('sender_id', $actor->id)
            ->pluck('id', 'recipient_id')
            ->all();

        return $this->cache[$actor->id] = [
            'friends' => Friendship::where('user_id', $actor->id)->pluck('friend_id')->all(),
            'outgoing' => array_keys($outgoingRequestIds),
            'incoming' => array_keys($incomingRequestIds),
            'incomingRequestIds' => $incomingRequestIds,
            'outgoingRequestIds' => $outgoingRequestIds,
        ];
    }
}
