<?php

declare(strict_types=1);

namespace forumaker\Friendship\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;
use forumaker\Friendship\FriendshipRequest;
use forumaker\Friendship\Support\UserDisplayHelper;

/**
 * Notifies the recipient that they received a friend request. The subject
 * is the sender (a User), not the FriendshipRequest row: the row is
 * deleted as soon as the request is accepted/declined/cancelled, and
 * Flarum's notification list query requires a subject that still exists.
 * The request's own id still travels in getData() though, so the frontend
 * can deep-link straight to it (see requests_modal's highlight handling).
 */
class FriendshipRequestedBlueprint implements BlueprintInterface, AlertableInterface
{
    protected User $sender;

    public function __construct(
        protected FriendshipRequest $request,
    ) {
        $this->sender = $request->sender;
    }

    public function getSubject(): ?AbstractModel
    {
        return $this->sender;
    }

    public function getFromUser(): ?User
    {
        return $this->sender;
    }

    public function getData(): mixed
    {
        return [
            'senderName' => UserDisplayHelper::resolve($this->sender),
            'requestId' => $this->request->id,
        ];
    }

    public static function getType(): string
    {
        return 'friendshipRequested';
    }

    public static function getSubjectModel(): string
    {
        return User::class;
    }
}
