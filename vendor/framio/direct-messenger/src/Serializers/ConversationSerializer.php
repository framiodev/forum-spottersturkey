<?php

namespace Framio\DirectMessenger\Serializers;

use Flarum\Api\Serializer\AbstractSerializer;
use Flarum\Api\Serializer\BasicUserSerializer;

class ConversationSerializer extends AbstractSerializer
{
    protected $type = 'conversations';

    protected function getDefaultAttributes($conversation)
    {
        $actor = $this->actor;
        $otherUsers = $conversation->users->where('id', '!=', $actor->id);
        $isGroup = $conversation->users->count() > 2;

        $title = $conversation->title;
        if (!$title) {
            if ($isGroup) {
                $names = $otherUsers->map(function ($u) { return $u->display_name; })->toArray();
                $title = implode(', ', $names);
            } else {
                $otherUser = $otherUsers->first();
                $title = $otherUser ? $otherUser->display_name : 'Bilinmeyen Kullanıcı';
            }
        }

        // For avatars, if it's a 1-on-1, use other user's avatar. If group, maybe return a list or null
        $avatarUrl = null;
        $participantAvatars = [];
        
        foreach ($otherUsers as $ou) {
            $participantAvatars[] = $ou->avatar_url;
            if (!$avatarUrl) {
                $avatarUrl = $ou->avatar_url; // Default to first other user for fallback
            }
        }
        
        $otherUserReadAt = null;
        $isStarred = false;
        $isArchived = false;
        $isDeleted = false;

        $currentUserPivot = $conversation->users->firstWhere('id', $actor->id);
        if ($currentUserPivot && $currentUserPivot->pivot) {
            $isStarred = (bool) $currentUserPivot->pivot->is_starred;
            $isArchived = (bool) $currentUserPivot->pivot->is_archived;
            $isDeleted = $currentUserPivot->pivot->deleted_at !== null;
        }

        // We can just get the most recent read_at among other users, or an array. 
        // For read receipts, we'll just check if EVERYONE read it, or ANYONE.
        // Let's just pick the max read_at for now to keep it simple.
        $maxReadAt = $otherUsers->max('pivot.read_at');
        if ($maxReadAt) {
            $otherUserReadAt = $this->formatDate($maxReadAt);
        }

        return [
            'title' => $title,
            'isGroup' => $isGroup,
            'avatarUrl' => $avatarUrl,
            'participantAvatars' => $participantAvatars,
            'otherUserReadAt' => $otherUserReadAt,
            'isStarred' => $isStarred,
            'isArchived' => $isArchived,
            'isDeleted' => $isDeleted,
            'createdAt' => $this->formatDate($conversation->created_at),
            'updatedAt' => $this->formatDate($conversation->updated_at),
        ];
    }

    protected function users($conversation)
    {
        return $this->hasMany($conversation, BasicUserSerializer::class);
    }

    protected function lastMessage($conversation)
    {
        return $this->hasOne($conversation, MessageSerializer::class);
    }
}
