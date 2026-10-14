<?php

namespace Framio\DirectMessenger\Events;

use Framio\DirectMessenger\Message;

class MessageCreated
{
    public $message;

    public function __construct(Message $message)
    {
        $this->message = $message;
    }
}
