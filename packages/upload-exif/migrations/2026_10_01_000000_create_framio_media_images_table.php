<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('framio_media_images')) {
            $schema->create('framio_media_images', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id')->nullable();
                $table->string('filename');
                $table->string('path'); // Vitrin/Görüntülenen URL (İmzalı veya varsayılan)
                $table->string('thumb_path')->nullable(); // Geriye dönük veya dinamik parametre
                $table->string('original_path')->nullable(); // Orijinal imzasız yüksek çözünürlüklü yedek
                $table->string('mime_type')->default('image/jpeg');
                $table->longText('exif_data')->nullable();
                $table->text('music_data')->nullable(); // Müzik bilgisi (JSON)
                $table->string('title')->nullable();
                $table->text('description')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();

                $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
                $table->index('user_id');
                $table->index('created_at');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_media_images');
    }
];
