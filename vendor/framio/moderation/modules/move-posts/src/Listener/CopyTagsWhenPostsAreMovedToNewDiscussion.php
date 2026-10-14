<?php

namespace FoF\MovePosts\Listener;

use FoF\MovePosts\Event\CreatedTargetDiscussion;

class CopyTagsWhenPostsAreMovedToNewDiscussion
{
    public function handle(CreatedTargetDiscussion $event): void
    {
        $sourceDiscussion = $event->sourceDiscussion;

        // Set the same tags as the old discussion
        if ($sourceDiscussion->tags && $sourceDiscussion->tags->isNotEmpty()) {
            $event->targetDiscussion->tags()->sync($sourceDiscussion->tags->pluck('id'));
        }
    }
}
