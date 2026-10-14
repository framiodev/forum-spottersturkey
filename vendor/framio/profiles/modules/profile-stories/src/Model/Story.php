<?php

namespace Framio\Profiles\ProfileStories\Model;

use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Story extends AbstractModel
{
    protected $table = 'stories';
    public $timestamps = true;

    protected $fillable = [
        'user_id',
        'title',
        'img_url',
        'cta',
        'content_icon',
        'content_text',
        'content_cta',
        'content_link',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
