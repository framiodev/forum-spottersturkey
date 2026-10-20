<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Sosyal medya için hazırlanan geçici tam boy, imzalı görseller (Firebase).
 * status: selected (seçildi) → queued (planlandı, paylaşılana kadar korunur) → published (15 dk sonra silinir)
 */
return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('framio_social_prepared')) {
            $schema->create('framio_social_prepared', function (Blueprint $table) {
                $table->increments('id');
                $table->string('source_url', 1000);
                $table->string('url', 500)->index();
                $table->string('object', 500);
                $table->string('status', 12)->default('selected')->index();
                $table->timestamp('delete_after')->nullable()->index();
                $table->timestamp('created_at')->nullable();
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_social_prepared');
    },
];
