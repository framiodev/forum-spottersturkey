<?php

namespace Framio\DirectMessenger;

use Flarum\Database\AbstractModel;

class VoiceSignal extends AbstractModel
{
    protected $table = 'voice_signals';

    public $timestamps = false;

    protected $fillable = [
        'room_id',
        'sender_id',
        'target_id',
        'type',
        'data',
        'created_at'
    ];
}
