<?php

declare(strict_types=1);

namespace forumaker\Friendship\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;
use forumaker\Friendship\Support\UserDisplayHelper;

/**
 * Notifies a user that they were removed from someone's friends. Subject is
 * the acting user (whoever removed the friendship — the other party, or a
 * moderator), same reasoning as FriendshipRequestedBlueprint: the
 * friendship row itself is gone by the time this fires.
 */
class FriendshipRemovedBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        protected User $remover,
    ) {
    }

    public function getSubject(): ?AbstractModel
    {
        return $this->remover;
    }

    public function getFromUser(): ?User
    {
        return $this->remover;
    }

    public function getData(): mixed
    {
        return [
            'removerName' => UserDisplayHelper::resolve($this->remover),
        ];
    }

    public static function getType(): string
    {
        return 'friendshipRemoved';
    }

    public static function getSubjectModel(): string
    {
        return User::class;
    }
}
