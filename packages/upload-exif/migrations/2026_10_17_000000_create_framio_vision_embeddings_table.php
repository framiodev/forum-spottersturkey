<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Görsel benzerlik dizini: her künyeli fotoğrafın Gemini görsel gömmesi (embedding).
 * Yeni yüklenen fotoğraf bu vektörlerle karşılaştırılır; en yakın geçmiş fotoğrafın
 * künyesi Vision AI'a referans olur.
 */
return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('framio_vision_embeddings')) {
            return;
        }
        $schema->create('framio_vision_embeddings', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('post_id')->index();
            $table->string('image_hash', 40)->unique();
            $table->string('image_url', 500);
            $table->binary('vec')->nullable();
            $table->string('model', 60)->nullable();
            $table->string('error', 190)->nullable();
            $table->timestamp('created_at')->nullable();
        });
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_vision_embeddings');
    },
];
