<?php

/*
 * This file is part of fof/moderator-warnings
 *
 * Copyright (c) Alexander Skvortsov.
 * Copyright (c) FriendsOfFlarum
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        $schema->table('warnings', function (Blueprint $table) {
            $table->mediumText('private_comment')->nullable()->change();
        });
    },
    'down' => function (Builder $schema) {
        $schema->table('warnings', function (Blueprint $table) {
            $table->mediumText('private_comment')->nullable(false)->change();
        });
    },
];
