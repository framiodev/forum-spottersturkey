<?php

/*
 * This file is part of fof/bookmarks.
 *
 * Copyright (c) 2026 FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\Bookmarks;

use Flarum\Api\Context;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;

/**
 * Constrains an eager-loaded `bookmarkState` relationship to the requesting actor.
 *
 * A post's bookmark state is per-user, but the relationship itself is defined on the
 * post. `Endpoint::eagerLoadWhere()` hands its callback the API context, which is what
 * allows the constraint to be applied at eager-load time — one query for the whole
 * page, and no global state to hold the actor.
 *
 * @param Relation<\Illuminate\Database\Eloquent\Model, \Illuminate\Database\Eloquent\Model, mixed>|Builder<\Illuminate\Database\Eloquent\Model> $query
 */
class ScopeBookmarkState
{
    /**
     * @param Relation<\Illuminate\Database\Eloquent\Model, \Illuminate\Database\Eloquent\Model, mixed>|Builder<\Illuminate\Database\Eloquent\Model> $query
     */
    public function __invoke($query, ?Context $context = null): void
    {
        $actor = $context?->getActor();

        // Guests never have bookmarks. Matching on a null user_id keeps the relationship
        // empty for them rather than leaking whichever rows happen to exist.
        $query->where('user_id', $actor && $actor->exists ? $actor->id : null);
    }
}
