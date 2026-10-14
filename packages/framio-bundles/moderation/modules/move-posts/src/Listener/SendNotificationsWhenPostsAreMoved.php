<?php

namespace FoF\MovePosts\Listener;

use Flarum\Notification\NotificationSyncer;
use Flarum\Post\CommentPost;
use FoF\MovePosts\Event\PostsMoved;
use FoF\MovePosts\Notification\PostMovedBlueprint;

class SendNotificationsWhenPostsAreMoved
{
    public function __construct(
        protected NotificationSyncer $notifications
    ) {
    }

    public function handle(PostsMoved $event): void
    {
        $actor = $event->actor;
        $posts = $event->posts
            ->filter(function (CommentPost $post) use ($actor) {
                return $post->user_id !== $actor->id;
            })
            ->unique('user_id');

        $this->notifications->sync(
            new PostMovedBlueprint($event->targetDiscussion, $event->sourceDiscussion),
            $posts->pluck('user')->all()
        );
    }
}
