<?php

namespace Framio\DirectMessenger;

use Flarum\Extend;
use Flarum\User\User;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/less/forum.less')
        ->route('/messages', 'framio.direct-messenger'),
        
    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/less/admin.less'),
        
    new Extend\Locales(__DIR__ . '/locale'),

    (new Extend\Routes('api'))
        ->get('/conversations', 'direct-messenger.conversations.index', Controllers\ListConversationsController::class)
        ->post('/conversations', 'direct-messenger.conversations.create', Controllers\CreateConversationController::class)
        ->patch('/conversations/{id}/state', 'direct-messenger.conversations.state', Controllers\UpdateConversationUserController::class)
        ->get('/messages', 'direct-messenger.messages.index', Controllers\ListMessagesController::class)
        ->get('/starred-messages', 'direct-messenger.messages.starred', Controllers\ListStarredMessagesController::class)
        ->post('/messages', 'direct-messenger.messages.create', Controllers\CreateMessageController::class)
        ->patch('/messages/{id}', 'direct-messenger.messages.update', Controllers\UpdateMessageController::class)
        ->post('/messages/{id}/star', 'direct-messenger.messages.star', Controllers\StarMessageController::class)
        ->delete('/messages/{id}', 'direct-messenger.messages.delete', Controllers\DeleteMessageController::class)
        ->get('/voice-rooms', 'direct-messenger.voice_rooms.index', Controllers\ListVoiceRoomsController::class)
        ->post('/voice-rooms/{id}/join', 'direct-messenger.voice_rooms.join', Controllers\JoinVoiceRoomController::class)
        ->delete('/voice-rooms/leave', 'direct-messenger.voice_rooms.leave', Controllers\LeaveVoiceRoomController::class)
        ->post('/voice-rooms/{id}/ping', 'direct-messenger.voice_rooms.ping', Controllers\PingVoiceRoomController::class)
        ->post('/voice-rooms/{id}/signal', 'direct-messenger.voice_rooms.signal', Controllers\SignalVoiceRoomController::class)
        ->get('/voice-rooms/{id}/signal', 'direct-messenger.voice_rooms.signal.get', Controllers\SignalVoiceRoomController::class)
        ->get('/text-channels', 'direct-messenger.text_channels.index', Controllers\ListTextChannelsController::class)
        ->post('/text-channels', 'direct-messenger.text_channels.create', Controllers\ManageTextChannelsController::class)
        ->patch('/text-channels/{id}', 'direct-messenger.text_channels.update', Controllers\ManageTextChannelsController::class)
        ->delete('/text-channels/{id}', 'direct-messenger.text_channels.delete', Controllers\ManageTextChannelsController::class)
        ->get('/text-channels/{id}/messages', 'direct-messenger.text_channels.messages.index', Controllers\TextChannelMessagesController::class)
        ->post('/text-channels/{id}/messages', 'direct-messenger.text_channels.messages.create', Controllers\TextChannelMessagesController::class)
        ->patch('/text-channel-messages/{id}', 'direct-messenger.text_channel_messages.update', Controllers\TextChannelMessageActionsController::class)
        ->delete('/text-channel-messages/{id}', 'direct-messenger.text_channel_messages.delete', Controllers\TextChannelMessageActionsController::class)
        ->post('/text-channel-messages/{id}/star', 'direct-messenger.text_channel_messages.star', Controllers\TextChannelMessageActionsController::class)
        ->get('/starred-text-messages', 'direct-messenger.text_channel_messages.starred', Controllers\ListStarredTextMessagesController::class),

    (new Extend\Model(User::class))
        ->belongsToMany('conversations', Conversation::class, 'conversation_user')
        ->belongsToMany('stars', Message::class, 'message_user_star', 'user_id', 'message_id')
        ->belongsToMany('textChannelStars', TextChannelMessage::class, 'text_channel_message_stars', 'user_id', 'message_id')
        ->hasMany('messages', Message::class),
];
