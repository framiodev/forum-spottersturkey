<?php

namespace Framio\DirectMessenger\Listeners;

use Framio\DirectMessenger\Events\MessageCreated;
use Pusher\Pusher;

class PushNewMessage
{
    /**
     * @var Pusher
     */
    protected $pusher;

    public function __construct(Pusher $pusher)
    {
        $this->pusher = $pusher;
    }

    public function handle(MessageCreated $event)
    {
        $message = $event->message;
        $conversation = $message->conversation;

        foreach ($conversation->users as $user) {
            $this->pusher->trigger('private-user' . $user->id, 'newMessengerMessage', [
                'messageId' => $message->id,
                'conversationId' => $conversation->id
            ]);
        }
    }
}
