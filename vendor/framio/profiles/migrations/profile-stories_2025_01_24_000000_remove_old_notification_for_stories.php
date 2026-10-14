<?php

use Illuminate\Database\Schema\Blueprint;

use Illuminate\Database\Schema\Builder;


return [
    'up' => function (Builder $schema) {
        $schema->getConnection()
            ->query()
            ->from('notifications')
            ->where('type', 'newStory')
            ->delete();
    },
    'down' => function (Builder $schema) {

    }
];
