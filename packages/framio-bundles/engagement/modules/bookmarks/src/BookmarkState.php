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

use Flarum\Database\AbstractModel;

/**
 * A row of the `post_user_bookmark` pivot table.
 *
 * This exists so the actor's bookmark can be eager-loaded as a `hasOne`
 * relationship on the post. Its presence or absence is the bookmark state, so the
 * model itself is never read from or written to.
 */
class BookmarkState extends AbstractModel
{
    protected $table = 'post_user_bookmark';
}
