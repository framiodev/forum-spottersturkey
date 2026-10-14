<?php

namespace Framio\DirectMessenger;

use Flarum\User\User;
use Carbon\Carbon;

class ResponseFormatter
{
    public static function formatConversation(Conversation $conversation, User $actor, array $included = []): array
    {
        $conversation->loadMissing(['users']);

        $otherUsers = $conversation->users->where('id', '!=', $actor->id);
        $isGroup = $conversation->users->count() > 2;

        $title = $conversation->title;
        if (!$title) {
            if ($isGroup) {
                $names = $otherUsers->map(fn($u) => $u->display_name)->toArray();
                $title = implode(', ', $names);
            } else {
                $otherUser = $otherUsers->first();
                $title = $otherUser ? $otherUser->display_name : 'Bilinmeyen Kullanıcı';
            }
        }

        $avatarUrl = null;
        $participantAvatars = [];
        $otherUsername = null;
        $otherUserId = null;
        $otherUserLastSeenAt = null;
        $otherUserIsOnline = false;

        if (!$isGroup && $otherUsers->first()) {
            $other = $otherUsers->first();
            $otherUsername = $other->username;
            $otherUserId = (string) $other->id;
            if ($other->last_seen_at) {
                $otherUserLastSeenAt = $other->last_seen_at->toIso8601String();
                // 5 minutes inactivity threshold for online status
                $otherUserIsOnline = $other->last_seen_at->diffInMinutes(Carbon::now()) < 5;
            }
        }
        foreach ($otherUsers as $ou) {
            $participantAvatars[] = $ou->avatar_url;
            if (!$avatarUrl) {
                $avatarUrl = $ou->avatar_url;
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

        $maxReadAt = $otherUsers->max('pivot.read_at');
        if ($maxReadAt) {
            $otherUserReadAt = Carbon::parse($maxReadAt)->toIso8601String();
        }

        $relationships = [];
        $relationships['users'] = [
            'data' => $conversation->users->map(fn($u) => [
                'type' => 'users',
                'id' => (string) $u->id
            ])->toArray()
        ];

        if ($conversation->last_message_id) {
            $relationships['lastMessage'] = [
                'data' => [
                    'type' => 'messages',
                    'id' => (string) $conversation->last_message_id
                ]
            ];
        }

        $unreadCount = 0;
        $currentUserReadAt = $currentUserPivot && $currentUserPivot->pivot ? $currentUserPivot->pivot->read_at : null;
        if ($currentUserReadAt) {
            $unreadCount = $conversation->messages()
                ->where('user_id', '!=', $actor->id)
                ->where('created_at', '>', $currentUserReadAt)
                ->whereNull('deleted_at')
                ->count();
        } else {
            $unreadCount = $conversation->messages()
                ->where('user_id', '!=', $actor->id)
                ->whereNull('deleted_at')
                ->count();
        }

        $lastMessageSnippet = null;
        $lastMessageCreatedAt = null;
        if ($conversation->lastMessage) {
            $lastMsg = $conversation->lastMessage;
            if ($lastMsg->deleted_at) {
                $lastMessageSnippet = 'Bu mesaj silindi.';
            } elseif ($lastMsg->type === 'image') {
                $lastMessageSnippet = '📷 Fotoğraf';
            } elseif ($lastMsg->type === 'audio') {
                $lastMessageSnippet = '🎤 Sesli Mesaj';
            } elseif ($lastMsg->type === 'post_share') {
                $lastMessageSnippet = '📌 Paylaşılan Gönderi';
            } else {
                $lastMessageSnippet = $lastMsg->content;
            }
            $lastMessageCreatedAt = $lastMsg->created_at ? $lastMsg->created_at->toIso8601String() : null;
        }

        return [
            'type' => 'conversations',
            'id' => (string) $conversation->id,
            'attributes' => [
                'title' => $title,
                'isGroup' => $isGroup,
                'avatarUrl' => $avatarUrl,
                'otherUsername' => $otherUsername,
                'otherUserId' => $otherUserId,
                'otherUserLastSeenAt' => $otherUserLastSeenAt,
                'otherUserIsOnline' => $otherUserIsOnline,
                'participantAvatars' => $participantAvatars,
                'otherUserReadAt' => $otherUserReadAt,
                'isStarred' => $isStarred,
                'isArchived' => $isArchived,
                'isDeleted' => $isDeleted,
                'unreadCount' => $unreadCount,
                'lastMessageSnippet' => $lastMessageSnippet,
                'lastMessageCreatedAt' => $lastMessageCreatedAt,
                'createdAt' => $conversation->created_at ? $conversation->created_at->toIso8601String() : null,
                'updatedAt' => $conversation->updated_at ? $conversation->updated_at->toIso8601String() : null,
            ],
            'relationships' => $relationships
        ];
    }

    public static function formatMessage(Message $message, ?User $actor = null): array
    {
        $isStarred = false;
        if ($actor) {
            $isStarred = $message->stars()->where('user_id', $actor->id)->exists();
        }

        $sender = $message->user;

        $relationships = [
            'user' => [
                'data' => [
                    'type' => 'users',
                    'id' => (string) $message->user_id
                ]
            ],
            'conversation' => [
                'data' => [
                    'type' => 'conversations',
                    'id' => (string) $message->conversation_id
                ]
            ]
        ];

        if ($message->reply_to_message_id) {
            $relationships['replyTo'] = [
                'data' => [
                    'type' => 'messages',
                    'id' => (string) $message->reply_to_message_id
                ]
            ];
        }

        return [
            'type' => 'messages',
            'id' => (string) $message->id,
            'attributes' => [
                'content' => $message->deleted_at ? null : $message->content,
                'type' => $message->deleted_at ? 'deleted' : $message->type,
                'isEdited' => $message->updated_at !== null,
                'isDeleted' => $message->deleted_at !== null,
                'isStarred' => $isStarred,
                'senderName' => $sender ? $sender->display_name : 'Bilinmeyen Kullanıcı',
                'senderAvatar' => $sender ? $sender->avatar_url : null,
                'createdAt' => $message->created_at ? $message->created_at->toIso8601String() : null,
                'updatedAt' => $message->updated_at ? $message->updated_at->toIso8601String() : null,
                'deletedAt' => $message->deleted_at ? $message->deleted_at->toIso8601String() : null,
            ],
            'relationships' => $relationships
        ];
    }

    public static function formatVoiceRoom(VoiceRoom $room): array
    {
        $room->loadMissing('users');

        return [
            'type' => 'voice_rooms',
            'id' => (string) $room->id,
            'attributes' => [
                'name' => $room->name,
                'icon' => $room->icon,
                'tagId' => $room->tag_id,
                'discussionId' => $room->discussion_id,
                'channelId' => $room->channel_id,
                'users' => $room->users->map(fn($u) => [
                    'id' => (string) $u->id,
                    'username' => $u->username,
                    'displayName' => $u->display_name,
                    'avatarUrl' => $u->avatar_url,
                ])->values()->toArray(),
            ],
            'relationships' => [
                'users' => [
                    'data' => $room->users->map(fn($u) => [
                        'type' => 'users',
                        'id' => (string) $u->id
                    ])->toArray()
                ]
            ]
        ];
    }

    public static function formatTextChannel(TextChannel $channel): array
    {
        $lastMessage = $channel->messages()->with('user')->latest('id')->first();

        $createdAtIso = null;
        if ($channel->created_at) {
            $createdAtIso = is_string($channel->created_at)
                ? (new \DateTime($channel->created_at))->format(\DateTime::ATOM)
                : $channel->created_at->toIso8601String();
        }

        $lastMessageCreatedAtIso = null;
        if ($lastMessage && $lastMessage->created_at) {
            $lastMessageCreatedAtIso = is_string($lastMessage->created_at)
                ? (new \DateTime($lastMessage->created_at))->format(\DateTime::ATOM)
                : $lastMessage->created_at->toIso8601String();
        }

        $voiceRoom = $channel->voiceRoom()->with('users')->first();
        $voiceRoomData = null;
        if ($voiceRoom) {
            $voiceRoomData = [
                'id' => (string) $voiceRoom->id,
                'name' => $voiceRoom->name,
                'icon' => $voiceRoom->icon,
                'users' => $voiceRoom->users->map(fn($u) => [
                    'id' => (string) $u->id,
                    'username' => $u->username,
                    'displayName' => $u->display_name,
                    'avatarUrl' => $u->avatar_url,
                ])->values()->toArray(),
            ];
        }

        return [
            'type' => 'text_channels',
            'id' => (string) $channel->id,
            'name' => $channel->name,
            'description' => $channel->description,
            'icon' => $channel->icon ?: 'fas fa-hashtag',
            'sort_order' => (int) $channel->sort_order,
            'is_active' => (bool) $channel->is_active,
            'discussion_id' => $channel->discussion_id,
            'created_at' => $createdAtIso,
            'attributes' => [
                'name' => $channel->name,
                'description' => $channel->description,
                'icon' => $channel->icon ?: 'fas fa-hashtag',
                'sortOrder' => (int) $channel->sort_order,
                'isActive' => (bool) $channel->is_active,
                'discussionId' => $channel->discussion_id,
                'createdAt' => $createdAtIso,
                'voiceRoom' => $voiceRoomData,
                'lastMessage' => $lastMessage ? [
                    'id' => (string) $lastMessage->id,
                    'message' => $lastMessage->message,
                    'senderName' => $lastMessage->user ? $lastMessage->user->display_name : 'Kullanıcı',
                    'createdAt' => $lastMessageCreatedAtIso,
                ] : null,
            ],
        ];
    }

    public static function formatTextChannelMessage(TextChannelMessage $msg, ?User $actor = null): array
    {
        $sender = $msg->user;

        $createdAtIso = null;
        if ($msg->created_at) {
            $createdAtIso = is_string($msg->created_at)
                ? (new \DateTime($msg->created_at))->format(\DateTime::ATOM)
                : $msg->created_at->toIso8601String();
        }

        $updatedAtIso = null;
        if ($msg->updated_at) {
            $updatedAtIso = is_string($msg->updated_at)
                ? (new \DateTime($msg->updated_at))->format(\DateTime::ATOM)
                : $msg->updated_at->toIso8601String();
        }

        $isStarred = false;
        if ($actor && !$actor->isGuest()) {
            $isStarred = $msg->stars()->where('user_id', $actor->id)->exists();
        }

        $isDeleted = $msg->deleted_at !== null;
        $isEdited = $msg->updated_at !== null && !$isDeleted;

        return [
            'type' => 'text_channel_messages',
            'id' => (string) $msg->id,
            'channel_id' => (string) $msg->channel_id,
            'user_id' => (string) $msg->user_id,
            'message' => $isDeleted ? 'Bu mesaj silindi.' : $msg->message,
            'msg_type' => $isDeleted ? 'deleted' : ($msg->type ?: 'text'),
            'is_starred' => $isStarred,
            'is_edited' => $isEdited,
            'is_deleted' => $isDeleted,
            'created_at' => $createdAtIso,
            'created_at_human' => $msg->created_at ? (is_string($msg->created_at) ? date('H:i', strtotime($msg->created_at)) : $msg->created_at->format('H:i')) : '',
            'user' => [
                'id' => $sender ? (string) $sender->id : null,
                'username' => $sender ? $sender->username : 'user',
                'display_name' => $sender ? $sender->display_name : 'Bilinmeyen',
                'avatar_url' => $sender ? $sender->avatar_url : null,
            ],
            'attributes' => [
                'channelId' => (string) $msg->channel_id,
                'userId' => (string) $msg->user_id,
                'message' => $isDeleted ? 'Bu mesaj silindi.' : $msg->message,
                'type' => $isDeleted ? 'deleted' : ($msg->type ?: 'text'),
                'isStarred' => $isStarred,
                'isEdited' => $isEdited,
                'isDeleted' => $isDeleted,
                'senderName' => $sender ? $sender->display_name : 'Bilinmeyen',
                'senderUsername' => $sender ? $sender->username : 'user',
                'senderAvatar' => $sender ? $sender->avatar_url : null,
                'createdAt' => $createdAtIso,
                'updatedAt' => $updatedAtIso,
            ],
        ];
    }
}