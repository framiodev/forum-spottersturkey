<?php

namespace Framio\UploadExif\Database;

use Flarum\Database\AbstractModel;

class MediaCityRoute extends AbstractModel
{
    protected $table = 'framio_media_city_routes';

    protected $fillable = [
        'city',
        'route_code',
        'route_name',
    ];
}
