<?php

namespace Framio\UploadExif\Database;

use Flarum\Database\AbstractModel;
use Flarum\User\User;

class FramioImage extends AbstractModel
{
    protected $table = 'framio_media_images';

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
