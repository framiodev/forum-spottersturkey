<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasColumn('post_comments', 'parent_id')) {
            $schema->table('post_comments', function (Blueprint $table) {
                // Yanıtlar tek seviyelidir: parent_id her zaman üst düzey yorumu gösterir
                $table->integer('parent_id')->unsigned()->nullable();
                // Birden çok görselli mesajda yorumun ait olduğu fotoğraf (0 tabanlı); null = mesajın geneli
                $table->smallInteger('photo_index')->unsigned()->nullable();
                $table->foreign('parent_id')->references('id')->on('post_comments')->onDelete('cascade');
            });
        }
        if (!$schema->hasTable('post_comment_likes')) {
            $schema->create('post_comment_likes', function (Blueprint $table) {
                $table->integer('comment_id')->unsigned();
                $table->integer('user_id')->unsigned();
                $table->timestamp('created_at')->nullable();
                $table->primary(['comment_id', 'user_id']);
                $table->foreign('comment_id')->references('id')->on('post_comments')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('post_comment_likes');
        $schema->table('post_comments', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropColumn(['parent_id', 'photo_index']);
        });
    },
];
