<?php

namespace Framio\DirectMessenger;

use Flarum\Database\AbstractModel;
use Flarum\Discussion\Discussion;

class TextChannel extends AbstractModel
{
    protected $table = 'text_channels';
    protected $fillable = ['name', 'description', 'icon', 'sort_order', 'is_active', 'discussion_id'];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function messages()
    {
        return $this->hasMany(TextChannelMessage::class, 'channel_id')
            ->orderBy('created_at', 'asc');
    }

    public function discussion()
    {
        return $this->belongsTo(Discussion::class, 'discussion_id');
    }

    public function voiceRoom()
    {
        return $this->hasOne(VoiceRoom::class, 'channel_id');
    }
}

