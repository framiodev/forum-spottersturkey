<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('messages')) {
            $schema->create('messages', function (Blueprint $table) {
                $table->increments('id');
                $table->integer('conversation_id')->unsigned();
                $table->integer('user_id')->unsigned()->nullable();
                $table->text('content')->nullable();
                $table->string('type')->default('text'); // text, image, audio
                $table->dateTime('created_at');
                
                $table->foreign('conversation_id')->references('id')->on('conversations')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            });
            
            // Now add the foreign key to conversations for last_message_id
            $schema->table('conversations', function (Blueprint $table) {
                $table->foreign('last_message_id')->references('id')->on('messages')->onDelete('set null');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->table('conversations', function (Blueprint $table) {
            $table->dropForeign(['last_message_id']);
        });
        $schema->dropIfExists('messages');
    }
];
