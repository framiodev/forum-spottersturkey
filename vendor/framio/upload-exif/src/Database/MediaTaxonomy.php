<?php

namespace Framio\UploadExif\Database;

use Flarum\Database\AbstractModel;

class MediaTaxonomy extends AbstractModel
{
    protected $table = 'framio_media_taxonomies';

    protected $fillable = [
        'brand',
        'model',
        'category',
        'tag_slug',
        'discussion_id',
        'city',
        'sort_order',
    ];
}
