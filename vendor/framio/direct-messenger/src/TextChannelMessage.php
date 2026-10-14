<?php

namespace Framio\DirectMessenger;

use Flarum\Database\AbstractModel;
use Flarum\User\User;

class TextChannelMessage extends AbstractModel
{
    protected $table = 'text_channel_messages';
    protected $fillable = ['channel_id', 'user_id', 'message', 'type', 'created_at', 'updated_at', 'deleted_at'];
    public $timestamps = false;

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function channel()
    {
        return $this->belongsTo(TextChannel::class, 'channel_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function stars()
    {
        return $this->belongsToMany(User::class, 'text_channel_message_stars', 'message_id', 'user_id')
            ->withPivot('created_at');
    }
}


