<?php

namespace Framio\DirectMessenger;

use Flarum\Database\AbstractModel;

class VoiceRoomUser extends AbstractModel
{
    protected $table = 'voice_room_users';
    protected $fillable = ['voice_room_id', 'user_id', 'last_ping_at'];

    protected $casts = [
        'last_ping_at' => 'datetime',
        'created_at' => 'datetime',
    ];
}
