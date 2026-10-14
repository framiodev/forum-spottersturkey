<?php

namespace Framio\DirectMessenger\Serializers;

use Flarum\Api\Serializer\AbstractSerializer;
use Flarum\Api\Serializer\BasicUserSerializer;

class VoiceRoomSerializer extends AbstractSerializer
{
    protected $type = 'voice_rooms';

    protected function getDefaultAttributes($room)
    {
        return [
            'name' => $room->name,
            'icon' => $room->icon,
            'tagId' => $room->tag_id,
        ];
    }

    protected function users($room)
    {
        return $this->hasMany($room, BasicUserSerializer::class);
    }
}
