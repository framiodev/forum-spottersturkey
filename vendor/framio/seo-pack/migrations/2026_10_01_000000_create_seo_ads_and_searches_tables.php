<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        // 1. Reklam Alanları Tablosu
        if (!$schema->hasTable('framio_seo_ads')) {
            $schema->create('framio_seo_ads', function (Blueprint $table) {
                $table->increments('id');
                $table->string('name', 100);
                $table->string('location', 50); // header_top, header_bottom, discussion_top, post_between, sidebar, footer_top
                $table->string('type', 30)->default('adsense'); // adsense, custom_html, banner
                $table->text('code')->nullable(); // AdSense snippet veya custom html
                $table->string('banner_image_url')->nullable();
                $table->string('banner_target_url')->nullable();
                $table->integer('post_interval')->default(5); // Her kaç mesajda bir çıksın
                $table->boolean('is_active')->default(true);
                $table->boolean('desktop_visible')->default(true);
                $table->boolean('mobile_visible')->default(true);
                $table->unsignedBigInteger('impressions_count')->default(0);
                $table->unsignedBigInteger('clicks_count')->default(0);
                $table->decimal('estimated_earnings', 10, 2)->default(0.00);
                $table->timestamps();

                $table->index('location');
                $table->index('is_active');
            });
        }

        // 2. Arama ve Trend Anahtar Kelimeler Tablosu (Forum İçi & GSC)
        if (!$schema->hasTable('framio_seo_searches')) {
            $schema->create('framio_seo_searches', function (Blueprint $table) {
                $table->increments('id');
                $table->string('query', 190);
                $table->string('source', 30)->default('forum'); // forum, gsc, trend
                $table->unsignedInteger('count')->default(1);
                $table->unsignedInteger('results_count')->default(0);
                $table->unsignedInteger('user_id')->nullable();
                $table->timestamp('last_searched_at')->useCurrent();
                $table->timestamps();

                $table->index('query');
                $table->index('source');
                $table->index('last_searched_at');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_seo_ads');
        $schema->dropIfExists('framio_seo_searches');
    }
];
