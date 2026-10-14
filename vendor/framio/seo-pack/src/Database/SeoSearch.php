<?php

namespace Framio\SeoPack\Database;

use Flarum\Database\AbstractModel;

class SeoSearch extends AbstractModel
{
    protected $table = 'framio_seo_searches';

    protected $fillable = [
        'query',
        'source',
        'count',
        'results_count',
        'user_id',
        'last_searched_at'
    ];

    protected $casts = [
        'count' => 'integer',
        'results_count' => 'integer',
        'user_id' => 'integer',
        'last_searched_at' => 'datetime'
    ];
}
