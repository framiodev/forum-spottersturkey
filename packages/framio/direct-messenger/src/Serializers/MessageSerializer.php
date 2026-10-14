<?php

namespace Framio\DirectMessenger\Serializers;

use Flarum\Api\Serializer\AbstractSerializer;
use Flarum\Api\Serializer\BasicUserSerializer;

class MessageSerializer extends AbstractSerializer
{
    protected $type = 'messages';

    protected function getDefaultAttributes($message)
    {
        $actor = $this->actor;
        $isStarred = $actor ? $message->stars()->where('user_id', $actor->id)->exists() : false;
        
        $sender = $message->user;

        return [
            'content' => $message->deleted_at ? null : $message->content,
            'type' => $message->deleted_at ? 'deleted' : $message->type,
            'isEdited' => $message->updated_at !== null,
            'isDeleted' => $message->deleted_at !== null,
            'isStarred' => $isStarred,
            'senderName' => $sender ? $sender->display_name : 'Bilinmeyen Kullanıcı',
            'senderAvatar' => $sender ? $sender->avatar_url : null,
            'createdAt' => $this->formatDate($message->created_at),
            'updatedAt' => $this->formatDate($message->updated_at),
            'deletedAt' => $this->formatDate($message->deleted_at),
        ];
    }

    protected function user($message)
    {
        return $this->hasOne($message, BasicUserSerializer::class);
    }

    protected function conversation($message)
    {
        return $this->hasOne($message, ConversationSerializer::class);
    }

    protected function replyTo($message)
    {
        return $this->hasOne($message, MessageSerializer::class);
    }
}
