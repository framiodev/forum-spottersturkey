<?php

/*
 * This file is part of fof/reactions.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Framio\Engagement\Reactions\Listener;

use Flarum\Notification\NotificationSyncer;
use Framio\Engagement\Reactions\Event\PostWasReacted;
use Framio\Engagement\Reactions\Notification\PostReactedBlueprint;
use Framio\Engagement\Reactions\PostAnonymousReaction;

class SendNotificationWhenPostIsReacted
{
    public function __construct(
        protected NotificationSyncer $notifications
    ) {
    }

    public function handle(PostWasReacted $event): void
    {
        // Don't send notifications for anonymous reactions
        if ($event->postReaction instanceof PostAnonymousReaction) {
            return;
        }

        $post = $event->post;
        $user = $event->user;

        // Don't notify the user if they reacted to their own post
        if ($post->user && $post->user->id != $user->id) {
            $this->notifications->sync(
                new PostReactedBlueprint($post, $user, $event->reaction),
                [$post->user]
            );
        }
    }
}
