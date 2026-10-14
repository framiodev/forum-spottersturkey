<?php

declare(strict_types=1);

namespace forumaker\Friendship\Support;

use Carbon\Carbon;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\Notification\NotificationSyncer;
use Flarum\User\User;
use Illuminate\Database\UniqueConstraintViolationException;
use forumaker\Friendship\Friendship;
use forumaker\Friendship\FriendshipEvent;
use forumaker\Friendship\FriendshipRequest;
use forumaker\Friendship\Notification\FriendshipDeclinedBlueprint;
use forumaker\Friendship\Notification\FriendshipRemovedBlueprint;
use forumaker\Friendship\Notification\FriendshipRequestedBlueprint;

/**
 * Centralizes every write path for friend requests/friendships: creating,
 * accepting, declining, cancelling and removing, plus the symmetric
 * `friendships`/`friendship_events` bookkeeping and notifications that go
 * along with each. Resources and controllers call into this instead of
 * touching the models directly, so that bookkeeping can't drift between the
 * different entry points (JSON:API resource vs. custom accept/decline
 * routes).
 */
class FriendshipManager
{
    public function __construct(
        protected NotificationSyncer $notifications,
        protected TranslatorInterface $translator,
    ) {
    }

    /**
     * @return array{status: 'requested'|'auto_accepted'}
     */
    public function sendRequest(User $actor, User $recipient): array
    {
        if ($actor->id === $recipient->id) {
            throw new ValidationException([
                'recipient' => $this->translator->trans('forumaker-friendship.lib.errors.self_request'),
            ]);
        }

        if ($this->areFriends($actor->id, $recipient->id)) {
            throw new ValidationException([
                'recipient' => $this->translator->trans('forumaker-friendship.lib.errors.already_friends'),
            ]);
        }

        // Mutual request: the recipient already asked the actor — accept
        // that one instead of creating a second, reversed pending row.
        $reverse = FriendshipRequest::where('sender_id', $recipient->id)
            ->where('recipient_id', $actor->id)
            ->first();

        if ($reverse) {
            $this->acceptRequest($actor, $reverse);

            return ['status' => 'auto_accepted'];
        }

        $existing = FriendshipRequest::where('sender_id', $actor->id)
            ->where('recipient_id', $recipient->id)
            ->first();

        if ($existing) {
            return ['status' => 'requested'];
        }

        $request = new FriendshipRequest();
        $request->sender_id = $actor->id;
        $request->recipient_id = $recipient->id;
        $request->created_at = Carbon::now();
        $request->setRelation('sender', $actor);
        $request->setRelation('recipient', $recipient);

        try {
            $request->getConnection()->transaction(function () use ($actor, $request, $recipient) {
                $request->save();

                $this->logEvent($actor, $actor, $recipient, FriendshipEvent::ACTION_REQUESTED);
            });
        } catch (UniqueConstraintViolationException $e) {
            // A concurrent request for the same pair won the race between our
            // $existing check above and this insert — same outcome as the
            // check finding it: the request already exists, nothing to do.
            return ['status' => 'requested'];
        }

        $this->notifications->sync(
            new FriendshipRequestedBlueprint($request),
            [$recipient]
        );

        return ['status' => 'requested'];
    }

    public function cancelRequest(User $actor, FriendshipRequest $request): void
    {
        $sender = $request->sender;
        $recipient = $request->recipient;

        $request->getConnection()->transaction(function () use ($actor, $request, $sender, $recipient) {
            $request->delete();

            $this->logEvent($actor, $sender, $recipient, FriendshipEvent::ACTION_CANCELLED);
        });
    }

    public function acceptRequest(User $actor, FriendshipRequest $request): void
    {
        $sender = $request->sender;
        $recipient = $request->recipient;

        FriendshipRequest::query()->getConnection()->transaction(function () use ($actor, $request, $sender, $recipient) {
            $now = $request->created_at ?? Carbon::now();

            Friendship::query()->firstOrCreate(
                ['user_id' => $sender->id, 'friend_id' => $recipient->id],
                ['created_at' => $now]
            );
            Friendship::query()->firstOrCreate(
                ['user_id' => $recipient->id, 'friend_id' => $sender->id],
                ['created_at' => $now]
            );

            $request->delete();

            $this->logEvent($actor, $sender, $recipient, FriendshipEvent::ACTION_ACCEPTED);
        });
    }

    public function declineRequest(User $actor, FriendshipRequest $request): void
    {
        $sender = $request->sender;
        $recipient = $request->recipient;

        $request->getConnection()->transaction(function () use ($actor, $request, $sender, $recipient) {
            $request->delete();

            $this->logEvent($actor, $sender, $recipient, FriendshipEvent::ACTION_DECLINED);
        });

        $this->notifications->sync(
            new FriendshipDeclinedBlueprint($actor),
            [$sender]
        );
    }

    public function removeFriend(User $actor, Friendship $friendship): void
    {
        $userId = $friendship->user_id;
        $friendId = $friendship->friend_id;

        $user = $friendship->user;
        $friend = $friendship->friend;

        Friendship::query()->getConnection()->transaction(function () use ($actor, $userId, $friendId, $user, $friend) {
            Friendship::where('user_id', $userId)->where('friend_id', $friendId)->delete();
            Friendship::where('user_id', $friendId)->where('friend_id', $userId)->delete();

            $this->logEvent($actor, $user, $friend, FriendshipEvent::ACTION_REMOVED);
        });

        $notify = array_values(array_filter([$user, $friend], fn (User $u) => $u->id !== $actor->id));

        if ($notify) {
            $this->notifications->sync(
                new FriendshipRemovedBlueprint($actor),
                $notify
            );
        }
    }

    public function areFriends(int $userId, int $otherUserId): bool
    {
        return Friendship::where('user_id', $userId)->where('friend_id', $otherUserId)->exists();
    }

    /**
     * Logs a symmetric history entry for both users involved — one row for
     * $userA, one for $userB, both pointing at the same actor/action/time.
     */
    protected function logEvent(User $actor, User $userA, User $userB, string $action): void
    {
        $now = Carbon::now();

        FriendshipEvent::create([
            'user_id' => $userA->id,
            'other_user_id' => $userB->id,
            'actor_id' => $actor->id,
            'action' => $action,
            'created_at' => $now,
        ]);
        FriendshipEvent::create([
            'user_id' => $userB->id,
            'other_user_id' => $userA->id,
            'actor_id' => $actor->id,
            'action' => $action,
            'created_at' => $now,
        ]);
    }
}
