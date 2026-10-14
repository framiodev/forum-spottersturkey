<?php

/*
 * This file is part of fof/drafts.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        $exists = (bool) $schema->getConnection()->selectOne(
            'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
            [
                $schema->getConnection()->getDatabaseName(),
                $schema->getConnection()->getTablePrefix().'drafts',
                $schema->getConnection()->getTablePrefix().'drafts_user_id_foreign',
            ]
        );

        if (! $exists) {
            $schema->table('drafts', function (Blueprint $table) {
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->table('drafts', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });
    },
];
