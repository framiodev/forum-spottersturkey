<?php

namespace Framio\PostComments\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\Post\Post;
use Flarum\User\User;
use Framio\PostComments\PostComment;

/** Bildirim: mesajınıza yorum yapıldı */
class PostCommentedBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(public Post $post, public PostComment $comment)
    {
    }

    public function getSubject(): ?AbstractModel
    {
        return $this->post;
    }

    public function getFromUser(): ?User
    {
        return $this->comment->user;
    }

    public function getData(): array
    {
        return [
            'commentId' => (int) $this->comment->id,
            'discussionId' => (int) $this->post->discussion_id,
            'postNumber' => (int) $this->post->number,
            'guestName' => $this->comment->user_id ? null : $this->comment->guest_name,
            'excerpt' => mb_substr($this->comment->content, 0, 140),
        ];
    }

    public static function getType(): string
    {
        return 'postCommented';
    }

    public static function getSubjectModel(): string
    {
        return Post::class;
    }
}
