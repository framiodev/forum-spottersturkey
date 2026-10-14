<?php

declare(strict_types=1);

namespace forumaker\Friendship\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;
use forumaker\Friendship\Support\UserDisplayHelper;

/**
 * Notifies the sender that their friend request was declined. Subject is
 * the decliner (a User) — the request row is deleted by the time this
 * fires, same reasoning as the other Friendship blueprints.
 */
class FriendshipDeclinedBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        protected User $decliner,
    ) {
    }

    public function getSubject(): ?AbstractModel
    {
        return $this->decliner;
    }

    public function getFromUser(): ?User
    {
        return $this->decliner;
    }

    public function getData(): mixed
    {
        return [
            'declinerName' => UserDisplayHelper::resolve($this->decliner),
        ];
    }

    public static function getType(): string
    {
        return 'friendshipDeclined';
    }

    public static function getSubjectModel(): string
    {
        return User::class;
    }
}
