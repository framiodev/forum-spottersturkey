<?php

namespace Framio\Profiles\ProfileStories\Notification;

use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;
use Framio\Profiles\ProfileStories\Model\Story;

class NewStoryNotificationBlueprint implements BlueprintInterface
{
    public Story $story;

    public function __construct(Story $story)
    {
        $this->story = $story;
    }

    public function getSubject(): ?\Flarum\Database\AbstractModel
    {
        return $this->story;
    }

    public function getFromUser(): ?\Flarum\User\User
    {
        return User::query()->where('username', $this->story->username)->first();
    }

    public function getData(): array
    {
        return [
            'message' => 'You have a new story!',
        ];
    }

    public static function getType(): string
    {
        return 'newStory';
    }

    public static function getSubjectModel(): string
    {
        return User::class;
    }
}