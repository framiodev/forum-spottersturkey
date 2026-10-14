<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('voice_room_users')) {
            $schema->create('voice_room_users', function (Blueprint $table) {
                $table->increments('id');
                $table->integer('voice_room_id')->unsigned();
                $table->integer('user_id')->unsigned();
                $table->timestamp('last_ping_at')->nullable();
                $table->timestamps();
                
                $table->foreign('voice_room_id')->references('id')->on('voice_rooms')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                
                // A user can only be in a room once
                $table->unique(['voice_room_id', 'user_id']);
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('voice_room_users');
    }
];
