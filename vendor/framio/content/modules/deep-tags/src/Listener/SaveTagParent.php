<?php

namespace Framio\Content\DeepTags\Listener;

use Flarum\Tags\Event\Saving;
use Flarum\Tags\Tag;
use Illuminate\Support\Arr;

class SaveTagParent
{
    public function handle(Saving $event): void
    {
        $tag = $event->tag;
        $data = $event->data;

        // API isteğindeki parent ilişkisi veya parentId attribute'u kontrol edilir
        if (Arr::has($data, 'relationships.parent.data.id')) {
            $parentId = Arr::get($data, 'relationships.parent.data.id');
            $tag->parent_id = $parentId ? (int) $parentId : null;
        } elseif (Arr::has($data, 'relationships.parent.data') && is_null(Arr::get($data, 'relationships.parent.data'))) {
            $tag->parent_id = null;
        } elseif (Arr::has($data, 'attributes.parentId')) {
            $parentId = Arr::get($data, 'attributes.parentId');
            $tag->parent_id = $parentId ? (int) $parentId : null;
        }

        // Eğer bir üst kategori atanmışsa, hiyerarşide kaybolmaması için birincil hiyerarşiye dahil et
        if ($tag->parent_id) {
            $tag->is_primary = true;
            if ($tag->position === null) {
                $maxPos = Tag::where('parent_id', $tag->parent_id)->max('position');
                $tag->position = is_numeric($maxPos) ? (int) $maxPos + 1 : 0;
            }
        }
    }
}
