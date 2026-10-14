<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Görsel boyutları: vitrin (path) ve küçük görsel (thumb_path).
 * Arama motorları (ImageObject width/height) ve sayfa düzeni kayması (CLS)
 * için kullanılır.
 */
return [
    'up' => function (Builder $schema) {
        if (!$schema->hasColumn('framio_media_images', 'width')) {
            $schema->table('framio_media_images', function (Blueprint $table) {
                $table->unsignedInteger('width')->nullable();
                $table->unsignedInteger('height')->nullable();
                $table->unsignedInteger('thumb_width')->nullable();
                $table->unsignedInteger('thumb_height')->nullable();
            });
        }
    },
    'down' => function (Builder $schema) {
        if ($schema->hasColumn('framio_media_images', 'width')) {
            $schema->table('framio_media_images', function (Blueprint $table) {
                $table->dropColumn(['width', 'height', 'thumb_width', 'thumb_height']);
            });
        }
    },
];
