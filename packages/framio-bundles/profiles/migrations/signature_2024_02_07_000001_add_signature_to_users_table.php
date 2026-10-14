<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if ($schema->hasColumn('users', 'signature')) {
            return;
        }

        $schema->table('users', function (Blueprint $table) {
            $table->text('signature')->nullable()->default(null);
        });
    },
    'down' => function (Builder $schema) {
        if (! $schema->hasColumn('users', 'signature')) {
            return;
        }

        $schema->table('users', function (Blueprint $table) {
            $table->dropColumn('signature');
        });
    }
];
