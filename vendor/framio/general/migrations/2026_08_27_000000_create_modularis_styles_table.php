<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('modularis_styles')) {
            return;
        }

        $schema->create('modularis_styles', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name', 200);
            $table->mediumText('css');
            $table->boolean('active')->default(false);
            $table->string('scope', 20)->default('forum');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    },

    'down' => function (Builder $schema) {
        $schema->dropIfExists('modularis_styles');
    },
];
