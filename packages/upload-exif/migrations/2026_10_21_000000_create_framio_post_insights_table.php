<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Gönderi istatistikleri (yalnızca yöneticiler görür): görüntülenme, fotoğraf başına inceleme süresi,
 * kaydırma davranışı, büyük görünüm, künye tıklamaları, konum (IP saklanmaz; yalnızca ülke/şehir).
 */
return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('framio_post_insights')) return;
        $schema->create('framio_post_insights', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedInteger('post_id');
            $table->unsignedInteger('image_id')->nullable();
            $table->string('visitor', 40);
            $table->unsignedInteger('user_id')->nullable();
            $table->string('type', 20); // view | dwell | slide | lightbox | click
            $table->string('label', 160)->nullable();
            $table->integer('value')->default(0);
            $table->string('country', 60)->nullable();
            $table->string('city', 80)->nullable();
            $table->string('device', 10)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['post_id', 'type']);
            $table->index('created_at');
        });
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_post_insights');
    },
];
