<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('post_comments')) {
            $schema->create('post_comments', function (Blueprint $table) {
                $table->increments('id');
                $table->integer('post_id')->unsigned();
                $table->integer('user_id')->unsigned()->nullable();
                $table->string('guest_name', 100)->nullable();
                $table->text('content');
                $table->timestamps();

                $table->foreign('post_id')->references('id')->on('posts')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('post_comments');
    }
];
