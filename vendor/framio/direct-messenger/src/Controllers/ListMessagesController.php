<?php

namespace Framio\DirectMessenger\Controllers;

use Flarum\Http\RequestUtil;
use Framio\DirectMessenger\Conversation;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Carbon\Carbon;
use Illuminate\Support\Arr;

class ListMessagesController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $conversationId = Arr::get($request->getQueryParams(), 'id');
        $conversation = Conversation::findOrFail($conversationId);

        // Ensure user is part of conversation
        if (!$conversation->users()->where('user_id', $actor->id)->exists()) {
            throw new PermissionDeniedException();
        }

        // Mark as read
        $conversation->users()->updateExistingPivot($actor->id, ['read_at' => Carbon::now()]);

        $messages = $conversation->messages()
            ->with(['user', 'replyTo'])
            ->orderBy('created_at', 'asc')
            ->get();

        $data = $messages->map(fn($msg) => ResponseFormatter::formatMessage($msg, $actor))->values()->toArray();

        return new JsonResponse(['data' => $data]);
    }
}

