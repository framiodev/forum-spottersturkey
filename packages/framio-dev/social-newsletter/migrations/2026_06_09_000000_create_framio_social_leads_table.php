<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('framio_social_leads')) {
            $schema->create('framio_social_leads', function (Blueprint $table) {
                $table->increments('id');
                $table->string('name')->nullable();
                $table->string('contact_type', 50)->nullable(); // whatsapp or instagram
                $table->string('contact_value')->nullable(); // phone number or username
                $table->boolean('is_contacted')->default(false);
                $table->boolean('is_following')->default(false);
                $table->timestamps();
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_social_leads');
    }
];
