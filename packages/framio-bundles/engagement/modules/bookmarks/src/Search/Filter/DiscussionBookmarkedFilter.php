<?php

/*
 * This file is part of fof/bookmarks.
 *
 * Copyright (c) 2026 FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\Bookmarks\Search\Filter;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Illuminate\Database\Query\Builder;

/**
 * Restricts a discussion listing to the actor's bookmarked discussions.
 *
 * Discussion bookmarks are a timestamp on core's `discussion_user` state table.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class DiscussionBookmarkedFilter implements FilterInterface
{
    public function getFilterKey(): string
    {
        return 'bookmarked';
    }

    public function filter(SearchState $state, array|string $value, bool $negate): void
    {
        $actor = $state->getActor();

        $method = $negate ? 'whereNotIn' : 'whereIn';

        $state->getQuery()->$method('discussions.id', function (Builder $query) use ($actor) {
            $query->select('discussion_id')
                ->from('discussion_user')
                ->where('user_id', $actor->id)
                ->whereNotNull('bookmarked_at');
        });
    }
}
