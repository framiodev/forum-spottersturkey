<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/** Otomatik koleksiyon kararları: hangi gönderi hangi kural için soruldu, sonuç ve eklenen mesaj */
return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('framio_auto_collect')) return;
        $schema->create('framio_auto_collect', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('rule_key', 40);
            $table->unsignedInteger('source_post_id');
            $table->string('decision', 5);
            $table->string('confidence', 10)->nullable();
            $table->unsignedInteger('target_post_id')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unique(['rule_key', 'source_post_id']);
            $table->index('target_post_id');
        });
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_auto_collect');
    },
];
