<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Sahne (arka plan) gömmesi: fotoğrafın üst şeridi (gökyüzü, bina, dağ, peron çatısı) ayrı
 * gömülür. Araçtan bağımsız olduğu için aynı yerde çekilmiş farklı araçların fotoğrafları
 * birbirine yakın düşer; çekim yeri hafızası bu sütunla çalışır.
 */
return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('framio_vision_embeddings') && !$schema->hasColumn('framio_vision_embeddings', 'scene_vec')) {
            $schema->table('framio_vision_embeddings', function (Blueprint $table) {
                $table->binary('scene_vec')->nullable();
            });
        }
    },
    'down' => function (Builder $schema) {
        if ($schema->hasColumn('framio_vision_embeddings', 'scene_vec')) {
            $schema->table('framio_vision_embeddings', fn (Blueprint $t) => $t->dropColumn('scene_vec'));
        }
    },
];
