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
 * Adds the `bookmarked_at` column used to store discussion bookmarks.
 *
 * The column may already exist when migrating from either of the extensions this
 * one replaces:
 *
 * - clarkwinkelmann/flarum-ext-bookmarks (v1) created the column without an index
 * - clarkwinkelmann/flarum-ext-discussion-bookmarks created it with an index
 *
 * In both cases the existing data is preserved: we only ever add what is missing.
 */
return [
    'up' => function (Builder $schema) {
        if (! $schema->hasColumn('discussion_user', 'bookmarked_at')) {
            $schema->table('discussion_user', function (Blueprint $table) {
                $table->timestamp('bookmarked_at')->nullable()->index();
            });

            return;
        }

        // The column already holds bookmarks from a previous extension. Leave the data
        // alone and only add the index if that extension did not create one.
        $indexes = $schema->getConnection()
            ->getDoctrineSchemaManager()
            ->listTableIndexes($schema->getConnection()->getTablePrefix().'discussion_user');

        foreach ($indexes as $index) {
            if (in_array('bookmarked_at', $index->getColumns(), true)) {
                return;
            }
        }

        $schema->table('discussion_user', function (Blueprint $table) {
            $table->index('bookmarked_at');
        });
    },
    'down' => function (Builder $schema) {
        /*
         * Intentionally a no-op.
         *
         * `bookmarked_at` lives on core's `discussion_user` table and may hold data
         * belonging to one of the extensions this one replaces. Dropping it on disable
         * would destroy user bookmarks that we do not exclusively own, and disabling an
         * extension should not lose data.
         */
    },
];
