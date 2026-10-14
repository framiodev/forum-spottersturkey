<?php

namespace Framio\UploadExif\Database;

use Flarum\Database\AbstractModel;

class MediaCategorySchema extends AbstractModel
{
    protected $table = 'framio_media_category_schemas';

    protected $fillable = [
        'parent_id',
        'name',
        'slug',
        'icon',
        'tag_slugs',
        'fields_config',
        'output_template',
        'sort_order',
    ];

    protected $casts = [
        'tag_slugs' => 'array',
        'fields_config' => 'array',
    ];

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order');
    }
}
