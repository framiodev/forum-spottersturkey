<?php

namespace Framio\DirectMessenger\Controllers;

use Flarum\Http\RequestUtil;
use Framio\DirectMessenger\Message;
use Framio\DirectMessenger\Conversation;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Illuminate\Support\Arr;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Support\Str;
use Illuminate\Contracts\Events\Dispatcher;
use Framio\DirectMessenger\Events\MessageCreated;
use Carbon\Carbon;

class CreateMessageController implements RequestHandlerInterface
{
    protected $events;

    public function __construct(Dispatcher $events)
    {
        $this->events = $events;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $data = Arr::get($request->getParsedBody(), 'data', []);
        $conversationId = Arr::get($data, 'attributes.conversationId');
        $content = Arr::get($data, 'attributes.content');
        $type = Arr::get($data, 'attributes.type', 'text');

        $conversation = Conversation::findOrFail($conversationId);

        if (!$conversation->users()->where('user_id', $actor->id)->exists()) {
            throw new PermissionDeniedException();
        }

        $replyToMessageId = Arr::get($data, 'attributes.replyToMessageId');

        // Handle file uploads (image/audio)
        $uploadedFiles = $request->getUploadedFiles();
        if (isset($uploadedFiles['media'])) {
            $file = $uploadedFiles['media'];
            $extension = pathinfo($file->getClientFilename(), PATHINFO_EXTENSION);
            if (!$extension && $type === 'audio') {
                $extension = 'webm';
            }
            if (!$extension && $type === 'image') {
                $extension = 'jpg';
            }

            $filename = Str::random(20) . '.' . $extension;
            $uploadDir = public_path('assets/messenger');
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            $file->moveTo($uploadDir . '/' . $filename);
            $content = '/assets/messenger/' . $filename;
        }

        $message = Message::build($conversation->id, $actor->id, $content, $type);
        if ($replyToMessageId) {
            $message->reply_to_message_id = $replyToMessageId;
        }
        $message->save();

        $conversation->last_message_id = $message->id;
        $conversation->updated_at = Carbon::now();
        $conversation->save();

        // Update pivot table read_at for the sender
        $conversation->users()->updateExistingPivot($actor->id, ['read_at' => Carbon::now()]);

        $this->events->dispatch(new MessageCreated($message));

        $message->load(['user', 'replyTo']);

        return new JsonResponse([
            'data' => ResponseFormatter::formatMessage($message, $actor)
        ], 201);
    }
}

