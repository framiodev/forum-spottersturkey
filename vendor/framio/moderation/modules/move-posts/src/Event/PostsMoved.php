<?php

namespace FoF\MovePosts\Event;

use Flarum\Discussion\Discussion;
use Flarum\Post\CommentPost;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Collection;

class PostsMoved
{
    /**
     * @param Collection<int, CommentPost> $posts
     */
    public function __construct(
        public Collection $posts,
        public Discussion $targetDiscussion,
        public Discussion $sourceDiscussion,
        public User $actor,
        public bool $targetCreated = false
    ) {
    }
}
