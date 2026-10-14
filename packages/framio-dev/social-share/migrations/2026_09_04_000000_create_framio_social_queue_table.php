<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('framio_social_queue')) {
            $schema->create('framio_social_queue', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id')->nullable();
                $table->text('payload');
                $table->string('status', 20)->default('pending')->index();
                $table->dateTime('scheduled_at')->nullable()->index();
                $table->text('response_log')->nullable();
                $table->timestamp('created_at')->useCurrent();
                $table->timestamp('updated_at')->nullable();
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_social_queue');
    }
];
