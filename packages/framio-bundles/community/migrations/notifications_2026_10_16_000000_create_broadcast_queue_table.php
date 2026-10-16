<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Telegram / WhatsApp grup yayını kuyruğu. Her mesaj bir kez kuyruğa girer;
 * her kanal için ayrı durum tutulur (bekliyor / gönderildi / hata / atlandı).
 */
return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('framio_broadcast_queue')) {
            return;
        }

        $schema->create('framio_broadcast_queue', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('post_id')->unique();
            $table->unsignedInteger('discussion_id');
            $table->string('kind', 20)->default('reply');
            $table->string('telegram_status', 20)->default('pending');
            $table->string('whatsapp_status', 20)->default('pending');
            $table->text('error')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('telegram_sent_at')->nullable();
            $table->timestamp('whatsapp_sent_at')->nullable();

            $table->index('telegram_status');
            $table->index('whatsapp_status');
            $table->foreign('post_id')->references('id')->on('posts')->onDelete('cascade');
        });
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_broadcast_queue');
    },
];
