<?php

namespace Framio\DirectMessenger;

use Flarum\Database\AbstractModel;
use Flarum\User\User;

class Conversation extends AbstractModel
{
    protected $table = 'conversations';
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function users()
    {
        return $this->belongsToMany(User::class, 'conversation_user')
            ->withPivot('read_at', 'deleted_at', 'is_starred', 'is_archived');
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }

    public function lastMessage()
    {
        return $this->belongsTo(Message::class, 'last_message_id');
    }

    public static function build()
    {
        $conversation = new static;
        $conversation->created_at = time();
        return $conversation;
    }
}
