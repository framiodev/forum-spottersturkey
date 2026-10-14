<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('conversation_user')) {
            $schema->create('conversation_user', function (Blueprint $table) {
                $table->integer('conversation_id')->unsigned();
                $table->integer('user_id')->unsigned();
                $table->dateTime('read_at')->nullable();
                $table->dateTime('deleted_at')->nullable();
                $table->primary(['conversation_id', 'user_id']);
                
                $table->foreign('conversation_id')->references('id')->on('conversations')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('conversation_user');
    }
];
