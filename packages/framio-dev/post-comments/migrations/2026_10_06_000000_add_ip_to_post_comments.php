<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasColumn('post_comments', 'ip_address')) {
            $schema->table('post_comments', function (Blueprint $table) {
                $table->string('ip_address', 45)->nullable();
                $table->index(['post_id', 'created_at']);
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->table('post_comments', function (Blueprint $table) {
            $table->dropIndex(['post_id', 'created_at']);
            $table->dropColumn('ip_address');
        });
    },
];
