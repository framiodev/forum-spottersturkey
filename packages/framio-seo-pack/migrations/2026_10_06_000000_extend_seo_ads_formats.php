<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Reklam alanları: biçim (satır içi / yapışkan alt şerit / açılır pencere), AdSense birimi,
 * sayfa ve bölüm hedeflemesi, gecikme / sıklık sınırı, üyelere gizleme ve yayın tarihleri.
 */
return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('framio_seo_ads') || $schema->hasColumn('framio_seo_ads', 'format')) {
            return;
        }

        $schema->table('framio_seo_ads', function (Blueprint $table) {
            $table->string('format', 20)->default('inline')->after('type');     // inline, sticky, popup
            $table->string('adsense_slot', 40)->nullable()->after('code');
            $table->string('adsense_format', 30)->default('auto')->after('adsense_slot'); // auto, horizontal, rectangle, vertical, fluid
            $table->string('page_scope', 20)->default('all')->after('location'); // all, home, discussion, tag
            $table->text('tag_slugs')->nullable()->after('page_scope');
            $table->unsignedInteger('delay_seconds')->default(8)->after('post_interval');
            $table->unsignedInteger('frequency_hours')->default(24)->after('delay_seconds');
            $table->boolean('hide_for_members')->default(false)->after('mobile_visible');
            $table->timestamp('starts_at')->nullable()->after('hide_for_members');
            $table->timestamp('ends_at')->nullable()->after('starts_at');
        });
    },
    'down' => function (Builder $schema) {
        if (!$schema->hasColumn('framio_seo_ads', 'format')) {
            return;
        }

        $schema->table('framio_seo_ads', function (Blueprint $table) {
            $table->dropColumn(['format', 'adsense_slot', 'adsense_format', 'page_scope', 'tag_slugs', 'delay_seconds', 'frequency_hours', 'hide_for_members', 'starts_at', 'ends_at']);
        });
    },
];
