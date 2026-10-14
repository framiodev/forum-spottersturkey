<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Künye dizini görsel bazında: bir mesajda birden çok araç olabilir
 * (çoklu açıklama). Her satır hangi görsele ait olduğunu ve o görselin
 * künye başlığını taşır; derleme sayfaları doğru fotoğrafı gösterir.
 */
return [
    'up' => function (Builder $schema) {
        if (!$schema->hasColumn('framio_seo_entities', 'image_url')) {
            $schema->table('framio_seo_entities', function (Blueprint $table) {
                $table->string('image_url', 500)->nullable();
                $table->string('caption', 190)->nullable();
            });
        }
    },
    'down' => function (Builder $schema) {
        if ($schema->hasColumn('framio_seo_entities', 'image_url')) {
            $schema->table('framio_seo_entities', function (Blueprint $table) {
                $table->dropColumn(['image_url', 'caption']);
            });
        }
    },
];
