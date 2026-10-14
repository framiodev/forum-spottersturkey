<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        $schema->table('framio_social_leads', function (Blueprint $table) {
            $table->text('push_endpoint')->nullable();
            $table->text('push_p256dh')->nullable();
            $table->text('push_auth')->nullable();
        });
    },
    'down' => function (Builder $schema) {
        $schema->table('framio_social_leads', function (Blueprint $table) {
            $table->dropColumn(['push_endpoint', 'push_p256dh', 'push_auth']);
        });
    }
];
