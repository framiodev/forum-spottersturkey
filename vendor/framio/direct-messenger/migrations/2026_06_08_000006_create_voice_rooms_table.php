<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('voice_rooms')) {
            $schema->create('voice_rooms', function (Blueprint $table) {
                $table->increments('id');
                $table->string('name');
                $table->string('icon')->nullable();
                $table->integer('tag_id')->unsigned()->nullable();
                $table->integer('discussion_id')->unsigned()->nullable();
                $table->timestamps();
                
                // Foreign key constraint if you have tags table, but since tags is from another extension, 
                // we'll just keep it loosely coupled.
                // $table->foreign('tag_id')->references('id')->on('tags')->onDelete('cascade');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('voice_rooms');
    }
];
