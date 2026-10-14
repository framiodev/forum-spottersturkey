<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('conversations')) {
            $schema->create('conversations', function (Blueprint $table) {
                $table->increments('id');
                $table->string('title')->nullable();
                $table->dateTime('created_at');
                $table->dateTime('updated_at')->nullable();
                $table->integer('last_message_id')->unsigned()->nullable();
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('conversations');
    }
];
