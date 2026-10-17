<?php

namespace FoF\Bookmarks\Search\Filter;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Illuminate\Database\Query\Builder;

/**
 * Yer imli mesajları bir kitaplıkla sınırlar ("bookmarkCollection" filtresi; değer kitaplık kimliği).
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class PostBookmarkCollectionFilter implements FilterInterface
{
    public function getFilterKey(): string
    {
        return 'bookmarkCollection';
    }

    public function filter(SearchState $state, array|string $value, bool $negate): void
    {
        $actor = $state->getActor();
        $collectionId = (int) (is_array($value) ? reset($value) : $value);

        $state->getQuery()->whereIn('id', function (Builder $query) use ($actor, $collectionId) {
            $query->select('post_id')
                ->from('post_user_bookmark')
                ->where('user_id', $actor->id)
                ->where('collection_id', $collectionId);
        }, 'and', $negate);
    }
}
