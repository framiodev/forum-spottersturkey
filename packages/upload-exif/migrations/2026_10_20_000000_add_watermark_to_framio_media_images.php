<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Her fotoğrafa yüklemede seçilen imza hatırlanır: sosyal medya paylaşımında imzasız orijinal
 * aynı imzayla yeniden işlenip tam kalitede gönderilir.
 */
return [
    'up' => function (Builder $schema) {
        if (!$schema->hasColumn('framio_media_images', 'watermark')) {
            $schema->table('framio_media_images', function (Blueprint $table) {
                $table->string('watermark', 190)->nullable();
                $table->string('watermark_owner', 100)->nullable();
            });
        }
    },
    'down' => function (Builder $schema) {
        if ($schema->hasColumn('framio_media_images', 'watermark')) {
            $schema->table('framio_media_images', function (Blueprint $table) {
                $table->dropColumn(['watermark', 'watermark_owner']);
            });
        }
    },
];
