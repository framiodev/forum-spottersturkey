<?php

/*
 * This file is part of fof/move-posts.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasColumn('discussions', 'is_first_moved')) {
            $schema->table('discussions', function (Blueprint $table) {
                $table->boolean('is_first_moved')->default(0);
            });
        }
    },
    'down' => function (Builder $schema) {
        if ($schema->hasColumn('discussions', 'is_first_moved')) {
            $schema->table('discussions', function (Blueprint $table) {
                $table->dropColumn('is_first_moved');
            });
        }
    }
];
