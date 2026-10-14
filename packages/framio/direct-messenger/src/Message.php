<?php

namespace Framio\DirectMessenger;

use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\SoftDeletes;

class Message extends AbstractModel
{
    use SoftDeletes;

    protected $table = 'messages';
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function replyTo()
    {
        return $this->belongsTo(Message::class, 'reply_to_message_id');
    }

    public function stars()
    {
        return $this->belongsToMany(User::class, 'message_user_star', 'message_id', 'user_id')->withPivot('created_at');
    }

    public static function build($conversationId, $userId, $content, $type = 'text')
    {
        $message = new static;
        $message->conversation_id = $conversationId;
        $message->user_id = $userId;
        $message->content = $content;
        $message->type = $type;
        $message->created_at = time();
        return $message;
    }
}
