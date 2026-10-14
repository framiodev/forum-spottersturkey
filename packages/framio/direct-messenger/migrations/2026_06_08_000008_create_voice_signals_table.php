<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('voice_signals')) {
            $schema->create('voice_signals', function (Blueprint $table) {
                $table->increments('id');
                $table->integer('room_id')->unsigned();
                $table->integer('sender_id')->unsigned();
                $table->integer('target_id')->unsigned();
                $table->string('type', 50);
                $table->mediumText('data');
                $table->timestamp('created_at')->useCurrent();

                $table->index('room_id');
                $table->index('target_id');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('voice_signals');
    }
];
