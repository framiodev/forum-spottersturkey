<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('voice_rooms') && !$schema->hasColumn('voice_rooms', 'discussion_id')) {
            $schema->table('voice_rooms', function (Blueprint $table) {
                $table->integer('discussion_id')->unsigned()->nullable();
            });
        }

        if ($schema->hasTable('voice_rooms') && !$schema->hasColumn('voice_rooms', 'channel_id')) {
            $schema->table('voice_rooms', function (Blueprint $table) {
                $table->integer('channel_id')->unsigned()->nullable();
            });
        }
    },
    'down' => function (Builder $schema) {
        if ($schema->hasTable('voice_rooms') && $schema->hasColumn('voice_rooms', 'channel_id')) {
            $schema->table('voice_rooms', function (Blueprint $table) {
                $table->dropColumn('channel_id');
            });
        }
    }
];
