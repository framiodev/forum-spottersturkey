<?php

use Illuminate\Database\Schema\Blueprint;

use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('stories')) {
            return;
        }

        $schema->create('stories', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedInteger('user_id');
            $table->text('title');
            $table->string('img_url');
            $table->text('cta');
            $table->text('content_icon');
            $table->text('content_text');
            $table->text('content_cta');
            $table->string('content_link');
            $table->timestamps();

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onDelete('cascade');
        });
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('stories');
    }
];
