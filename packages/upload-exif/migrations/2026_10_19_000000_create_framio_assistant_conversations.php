<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Framio Asistan sohbetleri: panel her açılışta yeni sohbetle başlar; eski sohbetler listelenir,
 * başa tutturulabilir, arşivlenebilir ya da silinebilir.
 */
return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('framio_assistant_conversations')) {
            $schema->create('framio_assistant_conversations', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id')->index();
                $table->string('title', 120);
                $table->boolean('pinned')->default(false);
                $table->boolean('archived')->default(false);
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }
        if (!$schema->hasColumn('framio_assistant_messages', 'conversation_id')) {
            $schema->table('framio_assistant_messages', function (Blueprint $table) {
                $table->unsignedInteger('conversation_id')->nullable()->index();
            });
        }
    },
    'down' => function (Builder $schema) {
        if ($schema->hasColumn('framio_assistant_messages', 'conversation_id')) {
            $schema->table('framio_assistant_messages', function (Blueprint $table) {
                $table->dropColumn('conversation_id');
            });
        }
        $schema->dropIfExists('framio_assistant_conversations');
    },
];
