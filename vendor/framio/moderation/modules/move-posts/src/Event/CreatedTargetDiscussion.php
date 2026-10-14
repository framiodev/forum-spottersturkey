<?php

namespace FoF\MovePosts\Event;

use Flarum\Discussion\Discussion;
use Flarum\User\User;

class CreatedTargetDiscussion
{
    public function __construct(
        public Discussion $targetDiscussion,
        public Discussion $sourceDiscussion,
        public User $actor
    ) {
    }
}
