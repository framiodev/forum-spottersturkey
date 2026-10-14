<?php

/*
 * This file is part of fof/move-posts.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\MovePosts\Notification;

use Flarum\Notification\AlertableInterface;
use Flarum\Discussion\Discussion;
use Flarum\Notification\Blueprint\BlueprintInterface;

class PostMovedBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public Discussion $targetDiscussion,
        public Discussion $sourceDiscussion
    ) {
    }

    public function getSubject(): ?\Flarum\Database\AbstractModel
    {
        return $this->sourceDiscussion;
    }

    public function getFromUser(): ?\Flarum\User\User
    {
        return null;
    }

    public function getData(): mixed
    {
        return [
            'targetDiscussionTitle' => $this->targetDiscussion->title,
            'targetDiscussionId' => $this->targetDiscussion->id,
        ];
    }

    public static function getType(): string
    {
        return 'postMoved';
    }

    public static function getSubjectModel(): string
    {
        return Discussion::class;
    }
}
