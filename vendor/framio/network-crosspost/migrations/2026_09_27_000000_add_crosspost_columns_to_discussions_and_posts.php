<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('discussions')) {
            $schema->table('discussions', function (Blueprint $table) use ($schema) {
                if (!$schema->hasColumn('discussions', 'crosspost_source_platform')) {
                    $table->string('crosspost_source_platform', 255)->nullable();
                }
                if (!$schema->hasColumn('discussions', 'crosspost_source_url')) {
                    $table->string('crosspost_source_url', 1024)->nullable();
                }
                if (!$schema->hasColumn('discussions', 'crosspost_source_author')) {
                    $table->string('crosspost_source_author', 255)->nullable();
                }
                if (!$schema->hasColumn('discussions', 'crosspost_source_author_url')) {
                    $table->string('crosspost_source_author_url', 1024)->nullable();
                }
                if (!$schema->hasColumn('discussions', 'crosspost_source_author_avatar')) {
                    $table->string('crosspost_source_author_avatar', 1024)->nullable();
                }
                if (!$schema->hasColumn('discussions', 'crosspost_sync_key')) {
                    $table->string('crosspost_sync_key', 255)->nullable()->index();
                }
            });
        }

        if ($schema->hasTable('posts')) {
            $schema->table('posts', function (Blueprint $table) use ($schema) {
                if (!$schema->hasColumn('posts', 'crosspost_source_platform')) {
                    $table->string('crosspost_source_platform', 255)->nullable();
                }
                if (!$schema->hasColumn('posts', 'crosspost_source_url')) {
                    $table->string('crosspost_source_url', 1024)->nullable();
                }
                if (!$schema->hasColumn('posts', 'crosspost_source_author')) {
                    $table->string('crosspost_source_author', 255)->nullable();
                }
            });
        }
    },
    'down' => function (Builder $schema) {
        if ($schema->hasTable('discussions')) {
            $schema->table('discussions', function (Blueprint $table) use ($schema) {
                $columns = [
                    'crosspost_source_platform',
                    'crosspost_source_url',
                    'crosspost_source_author',
                    'crosspost_source_author_url',
                    'crosspost_source_author_avatar',
                    'crosspost_sync_key',
                ];
                foreach ($columns as $column) {
                    if ($schema->hasColumn('discussions', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if ($schema->hasTable('posts')) {
            $schema->table('posts', function (Blueprint $table) use ($schema) {
                $columns = [
                    'crosspost_source_platform',
                    'crosspost_source_url',
                    'crosspost_source_author',
                ];
                foreach ($columns as $column) {
                    if ($schema->hasColumn('posts', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
];
