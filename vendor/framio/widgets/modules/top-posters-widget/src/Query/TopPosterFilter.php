<?php

/*
 * This file is part of fof/top-posters-widget.
 *
 * Copyright (c) 2021 FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\TopPosters\Query;

use FoF\TopPosters\UserRepository;
use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;

class TopPosterFilter implements FilterInterface
{
    public function __construct(private UserRepository $repository) {}

    public function getFilterKey(): string
    {
        return 'top_poster';
    }

    public function filter(SearchState $state, array|string $value, bool $negate): void
    {
        assert($state instanceof DatabaseSearchState);

        $ids = array_keys($this->repository->getTopPosters());

        if ($negate) {
            $state->getQuery()->whereNotIn('id', $ids);
        } else {
            $state->getQuery()->whereIn('id', $ids);
        }
    }
}
