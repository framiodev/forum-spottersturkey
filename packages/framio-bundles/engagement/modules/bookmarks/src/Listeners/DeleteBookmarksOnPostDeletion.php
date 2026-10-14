<?php

/*
 * This file is part of fof/bookmarks.
 *
 * Copyright (c) 2026 FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\Bookmarks\Listeners;

use Flarum\Post\Event\Deleted;
use Illuminate\Database\ConnectionInterface;

/**
 * Removes a deleted post's bookmarks.
 *
 * `post_user_bookmark` declares `cascadeOnDelete()` on `post_id`, but that cannot be
 * relied on across every database Flarum 2 supports: SQLite only enforces foreign keys
 * when `PRAGMA foreign_keys` is on, and it defaults to off on each new connection, so
 * the cascade silently does not fire there. Deleting the rows explicitly makes the
 * behaviour identical on MySQL, PostgreSQL and SQLite.
 *
 * This runs in addition to the cascade rather than instead of it. Where the cascade does
 * fire it has already removed the rows and this deletes nothing, which is harmless — the
 * pivot holds no state beyond the bookmark's existence.
 */
class DeleteBookmarksOnPostDeletion
{
    public function __construct(
        protected ConnectionInterface $db
    ) {
    }

    public function handle(Deleted $event): void
    {
        $this->db->table('post_user_bookmark')
            ->where('post_id', $event->post->id)
            ->delete();
    }
}
