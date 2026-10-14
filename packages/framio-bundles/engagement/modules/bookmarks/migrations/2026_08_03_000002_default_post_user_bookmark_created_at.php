<?php

/*
 * This file is part of fof/bookmarks.
 *
 * Copyright (c) 2026 FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

use Illuminate\Database\Schema\Builder;

/*
 * Brings a pre-existing `post_user_bookmark` table in line with the one this extension
 * creates.
 *
 * clarkwinkelmann/flarum-ext-post-bookmarks created the table with Laravel's
 * `timestamps()` helper, giving two `NOT NULL` columns with no default. This extension
 * inserts through a relationship that writes neither, relying on
 * `DEFAULT CURRENT_TIMESTAMP` instead, so `created_at` needs a default and the unused
 * `updated_at` has to become nullable.
 *
 * Raw statements are used because changing a column with Laravel's schema builder needs
 * doctrine/dbal to reflect the whole table, which fails on the enum columns elsewhere in
 * a typical Flarum database.
 *
 * Flarum 2 supports MySQL, PostgreSQL and SQLite, and the DDL to change a column differs
 * on each, so each driver is handled separately:
 *
 *  - MySQL uses `MODIFY`.
 *  - PostgreSQL uses `ALTER COLUMN`, one clause per change.
 *  - SQLite cannot alter a column at all. Nothing needs to be done there: the legacy
 *    extensions that created this table without the right defaults were MySQL-only, so a
 *    SQLite database only ever has the table created by this extension, which is already
 *    correct.
 */
return [
    'up' => function (Builder $schema) {
        if (! $schema->hasTable('post_user_bookmark')) {
            return;
        }

        $connection = $schema->getConnection();
        $driver = $connection->getDriverName();
        $table = $connection->getTablePrefix().'post_user_bookmark';
        $hasUpdatedAt = $schema->hasColumn('post_user_bookmark', 'updated_at');

        if ($driver === 'mysql') {
            $connection->statement(
                "ALTER TABLE `$table` MODIFY `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
            );

            if ($hasUpdatedAt) {
                $connection->statement(
                    "ALTER TABLE `$table` MODIFY `updated_at` TIMESTAMP NULL DEFAULT NULL"
                );
            }
        } elseif ($driver === 'pgsql') {
            $connection->statement(
                "ALTER TABLE \"$table\" ALTER COLUMN \"created_at\" SET NOT NULL, ALTER COLUMN \"created_at\" SET DEFAULT CURRENT_TIMESTAMP"
            );

            if ($hasUpdatedAt) {
                $connection->statement(
                    "ALTER TABLE \"$table\" ALTER COLUMN \"updated_at\" DROP NOT NULL, ALTER COLUMN \"updated_at\" SET DEFAULT NULL"
                );
            }
        }
    },
    'down' => function (Builder $schema) {
        /*
         * Intentionally a no-op: reverting the column definitions would make inserts fail
         * again, and the extension may be re-enabled.
         */
    },
];
