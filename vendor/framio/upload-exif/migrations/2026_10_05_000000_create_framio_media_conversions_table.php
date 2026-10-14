<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Format dönüştürücü günlüğü: her dönüştürülen görselin önceki hali ve gönderilerde yapılan
 * adres değişiklikleri tutulur; "Geri Al" bu kayıtlarla her şeyi eski haline döndürür.
 */
return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('framio_media_conversions')) return;
        $schema->create('framio_media_conversions', function (Blueprint $table) {
            $table->increments('id');
            $table->string('run', 32)->index();
            $table->unsignedInteger('image_id')->index();
            $table->json('before');            // path, thumb_path, original_path, filename, mime_type
            $table->json('replacements');      // gönderilerde uygulanan eski → yeni eşlemesi
            $table->json('post_ids');          // değişen gönderiler
            $table->json('new_objects');       // yüklenen yeni bulut nesneleri
            $table->json('old_objects');       // eski bulut nesneleri
            $table->boolean('old_deleted')->default(false);
            $table->timestamp('created_at')->nullable();
        });
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_media_conversions');
    },
];
