<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Yer imi kitaplıkları (Instagram'daki koleksiyonlar gibi): kullanıcı kaydettiği mesajları
 * adlandırdığı kitaplıklara ayırır. Bir yer imi en fazla bir kitaplıkta durur; kitaplık
 * silinince yer imleri silinmez, "Tümü"nde kalır.
 */
return [
    'up' => function (Builder $schema) {
        if (!$schema->hasTable('framio_bookmark_collections')) {
            $schema->create('framio_bookmark_collections', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id')->index();
                $table->string('name', 80);
                $table->unsignedInteger('position')->default(0);
                $table->timestamp('created_at')->nullable();

                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }

        if ($schema->hasTable('post_user_bookmark') && !$schema->hasColumn('post_user_bookmark', 'collection_id')) {
            $schema->table('post_user_bookmark', function (Blueprint $table) {
                $table->unsignedInteger('collection_id')->nullable()->index();
            });
        }
    },
    'down' => function (Builder $schema) {
        if ($schema->hasColumn('post_user_bookmark', 'collection_id')) {
            $schema->table('post_user_bookmark', fn (Blueprint $t) => $t->dropColumn('collection_id'));
        }
        $schema->dropIfExists('framio_bookmark_collections');
    },
];
