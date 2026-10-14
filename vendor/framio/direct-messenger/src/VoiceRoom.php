<?php

namespace Framio\DirectMessenger;

use Flarum\Database\AbstractModel;
use Flarum\User\User;

class VoiceRoom extends AbstractModel
{
    protected $table = 'voice_rooms';
    protected $fillable = ['name', 'icon', 'tag_id', 'discussion_id', 'channel_id'];

    public function users()
    {
        return $this->belongsToMany(User::class, 'voice_room_users')
            ->withPivot('last_ping_at', 'created_at')
            ->orderBy('voice_room_users.created_at', 'asc');
    }

    public function discussion()
    {
        return $this->belongsTo(\Flarum\Discussion\Discussion::class, 'discussion_id');
    }

    public function channel()
    {
        return $this->belongsTo(TextChannel::class, 'channel_id');
    }
}
