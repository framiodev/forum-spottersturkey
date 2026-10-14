<?php

namespace Framio\DirectMessenger\Controllers;

use Flarum\Http\RequestUtil;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class ListStarredMessagesController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        // Get messages starred by the user
        $messages = $actor->stars()
            ->with(['user', 'conversation', 'replyTo'])
            ->orderBy('message_user_star.created_at', 'desc')
            ->get();

        $data = $messages->map(fn($msg) => ResponseFormatter::formatMessage($msg, $actor))->values()->toArray();

        return new JsonResponse(['data' => $data]);
    }
}

