<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('message_user_star')) {
            $schema->create('message_user_star', function (Blueprint $table) {
                $table->integer('message_id')->unsigned();
                $table->integer('user_id')->unsigned();
                $table->dateTime('created_at')->nullable();
                $table->primary(['message_id', 'user_id']);
                
                $table->foreign('message_id')->references('id')->on('messages')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('message_user_star');
    }
];
