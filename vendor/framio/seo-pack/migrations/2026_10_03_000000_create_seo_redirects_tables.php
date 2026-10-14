<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('framio_seo_redirects')) {
            $schema->create('framio_seo_redirects', function (Blueprint $table) {
                $table->increments('id');
                $table->string('source', 190)->unique();   // /eski-yol?sorgu
                $table->string('target', 500)->nullable(); // /d/12-yeni veya tam URL; null + 410 = kalıcı olarak kaldırıldı
                $table->unsignedSmallInteger('status')->default(301);
                $table->string('origin', 20)->default('manual'); // manual | auto
                $table->unsignedInteger('hits')->default(0);
                $table->timestamp('last_hit_at')->nullable();
                $table->timestamps();
            });
        }

        if (!$schema->hasTable('framio_seo_not_found')) {
            $schema->create('framio_seo_not_found', function (Blueprint $table) {
                $table->increments('id');
                $table->string('path', 190)->unique();
                $table->unsignedInteger('hits')->default(0);
                $table->unsignedInteger('bot_hits')->default(0);
                $table->string('last_referrer', 255)->nullable();
                $table->string('last_user_agent', 190)->nullable();
                $table->timestamp('last_seen_at')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->index('hits');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_seo_redirects');
        $schema->dropIfExists('framio_seo_not_found');
    },
];
