<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Framio Asistan'ın öğrendiği yönlendirmeler: kullanıcı bir araç modelinin (ya da markanın)
 * fotoğrafını hangi başlığa paylaşıyorsa burada sayılır. Aynı başlığa art arda onaylanan
 * paylaşımlar "hits" olarak birikir; eşiği geçince asistan o başlığı kendisi seçer.
 */
return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('framio_assistant_routes')) {
            return;
        }
        $schema->create('framio_assistant_routes', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->string('route_key', 150);
            $table->unsignedInteger('discussion_id');
            $table->unsignedInteger('hits')->default(0);
            $table->timestamp('updated_at')->nullable();

            $table->unique(['user_id', 'route_key']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_assistant_routes');
    },
];
