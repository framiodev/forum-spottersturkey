<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Künye dizini: her mesajın künyesinden çıkarılan marka / model / firma /
 * plaka değerleri. Derleme sayfaları (/arac/{tür}/{slug}) bu tablodan beslenir;
 * her istekte mesaj içerikleri yeniden taranmaz.
 */
return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('framio_seo_entities')) {
            return;
        }

        $schema->create('framio_seo_entities', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('post_id');
            $table->unsignedInteger('discussion_id');
            $table->string('type', 16);   // brand | model | company | plate
            $table->string('name', 190);  // görünen ad
            $table->string('slug', 190);
            $table->timestamp('posted_at')->nullable();

            $table->index(['type', 'slug']);
            $table->index('post_id');
            $table->foreign('post_id')->references('id')->on('posts')->onDelete('cascade');
        });
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_seo_entities');
    },
];
