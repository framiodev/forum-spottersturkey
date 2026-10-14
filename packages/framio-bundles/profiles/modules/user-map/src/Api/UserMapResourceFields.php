<?php

namespace Framio\Profiles\UserMap\Api;

use Flarum\Api\Schema;

class UserMapResourceFields
{
    public function __invoke(): array
    {
        return [
            Schema\Str::make('location')
                ->property('location')
                ->nullable()
                ->writable(),

            Schema\Number::make('mapLat')
                ->property('map_lat')
                ->nullable(),

            Schema\Number::make('mapLon')
                ->property('map_lon')
                ->nullable(),
        ];
    }
}
