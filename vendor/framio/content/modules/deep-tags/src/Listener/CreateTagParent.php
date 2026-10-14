<?php

namespace Framio\Content\DeepTags\Listener;

use Flarum\Tags\Event\Creating;
use Flarum\Tags\Tag;
use Illuminate\Support\Arr;

class CreateTagParent
{
    public function handle(Creating $event): void
    {
        $tag = $event->tag;
        $data = $event->data;

        if (Arr::has($data, 'relationships.parent.data.id')) {
            $parentId = Arr::get($data, 'relationships.parent.data.id');
            $tag->parent_id = $parentId ? (int) $parentId : null;
        } elseif (Arr::has($data, 'attributes.parentId')) {
            $parentId = Arr::get($data, 'attributes.parentId');
            $tag->parent_id = $parentId ? (int) $parentId : null;
        }

        // Eğer yeni etiket bir üst kategoriye bağlanıyorsa, birincil hiyerarşiye dahil et
        if ($tag->parent_id) {
            $tag->is_primary = true;
            if ($tag->position === null) {
                $maxPos = Tag::where('parent_id', $tag->parent_id)->max('position');
                $tag->position = is_numeric($maxPos) ? (int) $maxPos + 1 : 0;
            }
        }
    }
}
