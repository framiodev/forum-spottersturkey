<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/** Yazım standardı geriye dönük uygulanırken gönderilerin eski içeriği (geri alma için) */
return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('framio_canon_backups')) return;
        $schema->create('framio_canon_backups', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('batch', 40)->index();
            $table->unsignedInteger('post_id');
            $table->mediumText('content');
            $table->timestamp('created_at')->nullable();
        });
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_canon_backups');
    },
];
