<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

// Grup duyurusunun site bildirimi (site içi / tarayıcı / e-posta) kanalı
return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('framio_broadcast_queue') && !$schema->hasColumn('framio_broadcast_queue', 'site_status')) {
            $schema->table('framio_broadcast_queue', function (Blueprint $table) {
                $table->string('site_status', 20)->default('skipped')->after('whatsapp_status');
                $table->timestamp('site_sent_at')->nullable();
            });
        }
    },
    'down' => function (Builder $schema) {
        if ($schema->hasTable('framio_broadcast_queue') && $schema->hasColumn('framio_broadcast_queue', 'site_status')) {
            $schema->table('framio_broadcast_queue', function (Blueprint $table) {
                $table->dropColumn(['site_status', 'site_sent_at']);
            });
        }
    },
];
