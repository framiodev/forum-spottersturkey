<?php

/*
 * This file is part of fof/bookmarks.
 *
 * Copyright (c) 2026 FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/*
 * Creates the pivot table used to store post bookmarks.
 *
 * The table may already exist and hold data when migrating from
 * clarkwinkelmann/flarum-ext-post-bookmarks (or the FlarumTR extension it was
 * itself derived from), in which case it is left untouched.
 *
 * `created_at` defaults to the current timestamp, following core's `post_likes` table.
 * That lets the relationship be declared with the typed `belongsToMany()` extender
 * rather than a closure calling `withTimestamps()`, which in turn keeps the relationship
 * visible to static analysis.
 */
return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('post_user_bookmark')) {
            return;
        }

        $schema->create('post_user_bookmark', function (Blueprint $table) {
            $table->unsignedInteger('post_id');
            $table->unsignedInteger('user_id');
            $table->timestamp('created_at')->useCurrent();

            $table->primary(['post_id', 'user_id']);

            $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    },
    'down' => function (Builder $schema) {
        /*
         * Intentionally a no-op.
         *
         * This table may hold bookmarks created by one of the extensions this one
         * replaces, so dropping it on disable would destroy user data we do not
         * exclusively own. Uninstalling the extension leaves the table behind; it can be
         * dropped manually if the data is genuinely no longer wanted.
         */
    },
];
