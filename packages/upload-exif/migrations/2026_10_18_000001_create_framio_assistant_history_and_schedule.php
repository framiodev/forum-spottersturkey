<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Framio Asistan:
 *  - framio_assistant_messages: her kullanıcının kendi sohbet geçmişi (panel her açılışta kaldığı yerden devam eder)
 *  - framio_assistant_schedule: planlanmış paylaşımlar (fotoğraf planlama anında yüklenir; zamanı gelince
 *    sunucu kullanıcı adına paylaşır ve sohbete haber bırakır)
 */
return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('framio_assistant_messages')) {
            $schema->create('framio_assistant_messages', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id')->index();
                $table->string('role', 10); // me | bot | notice
                $table->text('text');
                $table->boolean('seen')->default(true);
                $table->timestamp('created_at')->nullable();
                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }
        if (!$schema->hasTable('framio_assistant_schedule')) {
            $schema->create('framio_assistant_schedule', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id')->index();
                $table->string('plan', 40)->index(); // aynı komutla oluşturulanlar
                $table->unsignedInteger('discussion_id');
                $table->mediumText('content');
                $table->string('label', 190)->nullable();
                $table->timestamp('publish_at')->index();
                $table->string('status', 12)->default('pending'); // pending | done | failed | cancelled
                $table->unsignedInteger('post_id')->nullable();
                $table->string('error', 190)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_assistant_schedule');
        $schema->dropIfExists('framio_assistant_messages');
    },
];
