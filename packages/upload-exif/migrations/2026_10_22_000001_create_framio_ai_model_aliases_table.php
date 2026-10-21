<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Framio AI marka/model yazım eşlemesi (şehir içi, kamyon/çekici): AI'nın yazımı → forumdaki yazım.
 * Kullanıcı düzeltmelerinden öğrenilir.
 */
return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('framio_ai_model_aliases')) return;
        $schema->create('framio_ai_model_aliases', function (Blueprint $table) {
            $table->increments('id');
            $table->string('kind', 10); // city | truck
            $table->string('ai_key', 190);
            $table->string('brand', 100);
            $table->string('model', 160);
            $table->text('voters')->nullable();
            $table->unsignedSmallInteger('votes')->default(1);
            $table->boolean('trusted')->default(false);
            $table->timestamp('updated_at')->nullable();
            $table->unique(['kind', 'ai_key']);
        });
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_ai_model_aliases');
    },
];
