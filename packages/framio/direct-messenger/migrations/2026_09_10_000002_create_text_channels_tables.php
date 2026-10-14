<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('text_channels')) {
            $schema->create('text_channels', function (Blueprint $table) {
                $table->increments('id');
                $table->string('name', 255);
                $table->string('description', 255)->nullable();
                $table->string('icon', 100)->nullable()->default('fas fa-hashtag');
                $table->integer('sort_order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->integer('discussion_id')->unsigned()->nullable();
                $table->timestamps();

                $table->index('sort_order');
                $table->index('discussion_id');
            });

            // Seed default channels if empty
            $db = $schema->getConnection();
            $prefix = $db->getTablePrefix();
            $count = $db->table('text_channels')->count();
            if ($count === 0) {
                $now = new \DateTime();
                $db->table('text_channels')->insert([
                    [
                        'name' => 'genel-sohbet',
                        'description' => 'Genel topluluk sohbet kanalı',
                        'icon' => 'fas fa-comments',
                        'sort_order' => 1,
                        'is_active' => 1,
                        'discussion_id' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                    [
                        'name' => 'duyurular-ve-haberler',
                        'description' => 'Önemli duyuru ve haberler',
                        'icon' => 'fas fa-bullhorn',
                        'sort_order' => 2,
                        'is_active' => 1,
                        'discussion_id' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]
                ]);
            }
        }

        if (!$schema->hasTable('text_channel_messages')) {
            $schema->create('text_channel_messages', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->integer('channel_id')->unsigned();
                $table->integer('user_id')->unsigned()->nullable();
                $table->text('message');
                $table->string('type', 50)->default('text');
                $table->dateTime('created_at');
                $table->dateTime('updated_at')->nullable();
                $table->dateTime('deleted_at')->nullable();

                $table->index('channel_id');
                $table->index('user_id');
                $table->index('created_at');
            });
        }

        if (!$schema->hasTable('text_channel_message_stars')) {
            $schema->create('text_channel_message_stars', function (Blueprint $table) {
                $table->bigInteger('message_id')->unsigned();
                $table->integer('user_id')->unsigned();
                $table->dateTime('created_at')->nullable();

                $table->primary(['message_id', 'user_id']);
                $table->index('user_id');
            });
        }
    },
    'down' => function (Builder $schema) {
        $schema->dropIfExists('text_channel_message_stars');
        $schema->dropIfExists('text_channel_messages');
        $schema->dropIfExists('text_channels');
    }
];
