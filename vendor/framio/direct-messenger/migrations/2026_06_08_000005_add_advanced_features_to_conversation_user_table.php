<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('conversation_user')) {
            $schema->table('conversation_user', function (Blueprint $table) use ($schema) {
                if (!$schema->hasColumn('conversation_user', 'is_starred')) {
                    $table->boolean('is_starred')->default(false);
                }
                if (!$schema->hasColumn('conversation_user', 'is_archived')) {
                    $table->boolean('is_archived')->default(false);
                }
            });
        }
    },
    'down' => function (Builder $schema) {
        if ($schema->hasTable('conversation_user')) {
            $schema->table('conversation_user', function (Blueprint $table) use ($schema) {
                if ($schema->hasColumn('conversation_user', 'is_starred')) {
                    $table->dropColumn('is_starred');
                }
                if ($schema->hasColumn('conversation_user', 'is_archived')) {
                    $table->dropColumn('is_archived');
                }
            });
        }
    }
];
