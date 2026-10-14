<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        $schema->table('users', function (Blueprint $table) use ($schema) {
            if (!$schema->hasColumn('users', 'cover_focal_x')) {
                $table->smallInteger('cover_focal_x')->nullable()->default(50);
            }
            if (!$schema->hasColumn('users', 'cover_focal_y')) {
                $table->smallInteger('cover_focal_y')->nullable()->default(50);
            }
            if (!$schema->hasColumn('users', 'cover_zoom')) {
                $table->decimal('cover_zoom', 4, 2)->nullable()->default(1.00);
            }
        });
    },

    'down' => function (Builder $schema) {
        $schema->table('users', function (Blueprint $table) use ($schema) {
            if ($schema->hasColumn('users', 'cover_focal_x')) {
                $table->dropColumn('cover_focal_x');
            }
            if ($schema->hasColumn('users', 'cover_focal_y')) {
                $table->dropColumn('cover_focal_y');
            }
            if ($schema->hasColumn('users', 'cover_zoom')) {
                $table->dropColumn('cover_zoom');
            }
        });
    },
];
