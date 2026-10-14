<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('framio_debug_logs')) {
            return;
        }
        $schema->create('framio_debug_logs', function (Blueprint $table) {
            $table->increments('id');
            // Aynı hata tek satırda toplanır; tekrarları count ile sayılır
            $table->string('fingerprint', 40)->unique();
            $table->string('severity', 12)->index();      // critical | error | warning | notice
            $table->string('origin', 12)->index();        // server | client | log
            $table->string('frontend', 12)->nullable();   // forum | admin | api | console
            $table->string('source', 120)->nullable()->index(); // eklenti kimliği / çekirdek
            $table->string('source_title', 190)->nullable();
            $table->string('exception', 190)->nullable();
            $table->text('message');
            $table->string('file', 500)->nullable();
            $table->unsignedInteger('line')->nullable();
            $table->mediumText('trace')->nullable();
            $table->mediumText('context')->nullable();    // JSON: istek, kullanıcı, tarayıcı
            $table->string('url', 500)->nullable();
            $table->unsignedInteger('count')->default(1);
            $table->boolean('resolved')->default(false)->index();
            $table->dateTime('first_seen_at');
            $table->dateTime('last_seen_at')->index();
        });
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_debug_logs');
    },
];
