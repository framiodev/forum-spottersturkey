<?php

/*
 * This file is part of fof/bookmarks.
 *
 * Copyright (c) 2026 FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\Bookmarks\Search;

use Flarum\Discussion\Discussion;
use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\SearchCriteria;
use FoF\Bookmarks\Search\Filter\DiscussionBookmarkedFilter;
use Illuminate\Database\Eloquent\Builder;

/**
 * Keeps bookmarked blog articles in the bookmarks list.
 *
 * fof/blog's `HideBlogPostsFromAllDiscussionsPage` mutator excludes blog-tagged
 * discussions from every `DiscussionSearcher` query, standing down only when a blog or
 * fulltext filter is active. A bookmarks listing is neither, so without this the article
 * is saved as a bookmark but never shown.
 *
 * Blog hides articles with `whereNotIn('discussions.id', <blog-tagged>)`. Unpicking that
 * constraint is not possible from here, so instead the whole accumulated set of
 * constraints is wrapped and OR'd with "is one of the actor's bookmarks":
 *
 *     (<everything applied so far>) or discussions.id in (<actor's bookmarks>)
 *
 * `Builder::orWhere()` with a closure produces exactly that nesting. It is safe against
 * the visibility scope the searcher starts from, because the right-hand side of the OR is
 * itself constrained to `whereVisibleTo($actor)` — so a discussion the actor may not see
 * cannot be re-admitted even if they somehow hold a bookmark row for it.
 */
class AllowBlogArticlesWhenFilteringBookmarks
{
    public function __invoke(DatabaseSearchState $state, SearchCriteria $criteria): void
    {
        $actor = $state->getActor();

        if (! $actor->exists) {
            return;
        }

        // Only relax the query for a bookmarks listing. Every other discussion list has to
        // keep hiding articles exactly as blog intends.
        if (! $this->filteringOnBookmarks($criteria)) {
            return;
        }

        $state->getQuery()->orWhere(function (Builder $query) use ($actor) {
            $query
                ->whereIn('discussions.id', function ($subquery) use ($actor) {
                    $subquery->select('discussion_id')
                        ->from('discussion_user')
                        ->where('user_id', $actor->id)
                        ->whereNotNull('bookmarked_at');
                })
                // Re-assert visibility on this branch of the OR: it is a fresh conjunct,
                // so it does not inherit the searcher's initial visibility scope.
                ->whereIn('discussions.id', Discussion::whereVisibleTo($actor)->select('discussions.id'));
        });
    }

    /**
     * Whether this request asks for bookmarked discussions.
     *
     * The raw criteria are read rather than `getActiveFilters()`, because that records
     * which filter classes ran but not whether they were negated. `filter[-bookmarked]`
     * asks for everything *except* bookmarks, and re-admitting them there would undo the
     * negation.
     */
    private function filteringOnBookmarks(SearchCriteria $criteria): bool
    {
        $key = (new DiscussionBookmarkedFilter())->getFilterKey();

        return array_key_exists($key, $criteria->filters);
    }
}
