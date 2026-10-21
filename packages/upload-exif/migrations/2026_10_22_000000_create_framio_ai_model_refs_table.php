<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Framio AI model referans görselleri: sık karıştırılan modeller için örnek fotoğraflar
 * (admin yüklemesi, forumdan seçim ya da web araması). Model doğrulamada yapay zekâya örnek olarak gider.
 */
return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('framio_ai_model_refs')) return;
        $schema->create('framio_ai_model_refs', function (Blueprint $table) {
            $table->increments('id');
            $table->string('brand', 100);
            $table->string('model', 160);
            $table->string('tag_slugs', 255)->nullable(); // boşsa tüm kategoriler
            $table->string('source', 10)->default('upload'); // upload | forum | web | url
            $table->text('url');
            $table->string('note', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['brand', 'model']);
        });
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_ai_model_refs');
    },
];
