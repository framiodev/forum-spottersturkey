<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('framio_speed_metrics')) {
            $schema->create('framio_speed_metrics', function (Blueprint $table) {
                $table->increments('id');
                $table->string('type', 50)->index();
                $table->text('url')->nullable();
                $table->integer('duration_ms');
                $table->timestamp('created_at')->useCurrent();
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_speed_metrics');
    }
];
