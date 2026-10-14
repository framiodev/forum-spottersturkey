<?php

/*
 * Çevrimiçi Kullanıcılar: üyelerin anlık etkinliği (hangi sayfada, ne yapıyor).
 * Kullanıcı başına tek satır; tarayıcı sayfa değiştikçe günceller.
 */

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('framio_user_activity')) {
            $schema->create('framio_user_activity', function (Blueprint $table) {
                $table->unsignedInteger('user_id')->primary();
                $table->string('type', 32);
                $table->unsignedInteger('subject_id')->nullable();
                $table->string('extra', 32)->nullable();
                $table->timestamp('updated_at')->nullable()->index();

                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            });
        }

        // Etkinliği görme izni: varsayılan olarak üyelere (grup 3) açık
        $db = $schema->getConnection();
        if (!$db->table('group_permission')->where('permission', 'framio.viewUserActivity')->exists()) {
            $db->table('group_permission')->insert(['group_id' => 3, 'permission' => 'framio.viewUserActivity']);
        }
    },

    'down' => function (Builder $schema) {
        $schema->dropIfExists('framio_user_activity');
        $schema->getConnection()->table('group_permission')->where('permission', 'framio.viewUserActivity')->delete();
    },
];
