<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        $schema->table('messages', function (Blueprint $table) {
            $table->integer('reply_to_message_id')->unsigned()->nullable();
            $table->dateTime('updated_at')->nullable();
            $table->dateTime('deleted_at')->nullable();

            $table->foreign('reply_to_message_id')->references('id')->on('messages')->onDelete('set null');
        });
    },
    'down' => function (Builder $schema) {
        $schema->table('messages', function (Blueprint $table) {
            $table->dropForeign(['reply_to_message_id']);
            $table->dropColumn('reply_to_message_id');
            $table->dropColumn('updated_at');
            $table->dropColumn('deleted_at');
        });
    }
];
