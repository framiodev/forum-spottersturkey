<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasColumn('posts', 'seo_last_sent_at')) {
            $schema->table('posts', function (Blueprint $table) {
                $table->timestamp('seo_last_sent_at')->nullable();
            });
        }
    },
    'down' => function (Builder $schema) {
        if ($schema->hasColumn('posts', 'seo_last_sent_at')) {
            $schema->table('posts', function (Blueprint $table) {
                $table->dropColumn('seo_last_sent_at');
            });
        }
    }
];
