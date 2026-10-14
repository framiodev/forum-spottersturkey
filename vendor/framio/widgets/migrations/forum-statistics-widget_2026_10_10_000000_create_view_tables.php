<?php

/*
 * Forum İstatistikleri: tartışma ve mesaj görüntülenme kayıtları.
 *
 * framio_view_log   Günlük tekil görüntülenmeler. post_id = 0 → tartışmanın kendisi.
 *                   Üyeler user_id ile; ziyaretçiler IP saklanmadan, her gün değişen
 *                   bir özetle (visitor) kaydedilir. Aynı ziyaretçi aynı gün bir kez sayılır.
 * framio_post_views Mesaj başına toplam (tekil-günlük) görüntülenme.
 *
 * İzinler: İstatistik sayfası ve kimlerin görüntülediği moderatörlere,
 * mesaj görüntülenme sayısı üyelere açık başlar (admin → İzinler'den değiştirilir).
 */

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('framio_view_log')) {
            $schema->create('framio_view_log', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->unsignedInteger('discussion_id');
                $table->unsignedInteger('post_id')->default(0);
                $table->unsignedInteger('user_id')->nullable();
                $table->char('visitor', 40);
                $table->date('viewed_on');
                $table->timestamp('created_at')->nullable();

                $table->unique(['discussion_id', 'post_id', 'visitor', 'viewed_on'], 'framio_view_log_unique');
                $table->index(['post_id', 'viewed_on']);
                $table->index('viewed_on');
                $table->index('user_id');
                $table->foreign('discussion_id')->references('id')->on('discussions')->onDelete('cascade');
            });
        }

        if (!$schema->hasTable('framio_post_views')) {
            $schema->create('framio_post_views', function (Blueprint $table) {
                $table->unsignedInteger('post_id')->primary();
                $table->unsignedInteger('views')->default(0);
                $table->foreign('post_id')->references('id')->on('posts')->onDelete('cascade');
            });
        }

        $db = $schema->getConnection();
        foreach ([
            'framio-stats.viewPage' => 4,
            'framio-stats.viewPostViews' => 3,
            'framio-stats.viewViewers' => 4,
        ] as $permission => $group) {
            if (!$db->table('group_permission')->where('permission', $permission)->exists()) {
                $db->table('group_permission')->insert(['group_id' => $group, 'permission' => $permission]);
            }
        }
    },

    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_post_views');
        $schema->dropIfExists('framio_view_log');
        $schema->getConnection()->table('group_permission')
            ->whereIn('permission', ['framio-stats.viewPage', 'framio-stats.viewPostViews', 'framio-stats.viewViewers'])
            ->delete();
    },
];
