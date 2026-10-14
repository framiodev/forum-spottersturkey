<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('framio_media_taxonomies')) {
            $schema->create('framio_media_taxonomies', function (Blueprint $table) {
                $table->increments('id');
                $table->string('brand');
                $table->string('model');
                $table->string('category')->default('Varsayılan');
                $table->string('tag_slug')->nullable();
                $table->unsignedInteger('discussion_id')->nullable();
                $table->string('city')->nullable();
                $table->integer('sort_order')->default(0);
                $table->timestamps();

                $table->index('brand');
                $table->index('category');
                $table->index('tag_slug');
                $table->index('discussion_id');
            });
        }

        if (!$schema->hasTable('framio_media_city_routes')) {
            $schema->create('framio_media_city_routes', function (Blueprint $table) {
                $table->increments('id');
                $table->string('city');
                $table->string('route_code');
                $table->string('route_name');
                $table->timestamps();

                $table->index('city');
                $table->index('route_code');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_media_city_routes');
        $schema->dropIfExists('framio_media_taxonomies');
    }
];
