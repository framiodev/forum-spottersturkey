<?php

namespace Framio\DirectMessenger\Controllers;

use Flarum\Http\RequestUtil;
use Framio\DirectMessenger\TextChannelMessage;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class ListStarredTextMessagesController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if (!$actor || $actor->isGuest()) {
            return new JsonResponse(['data' => []]);
        }

        $messages = TextChannelMessage::whereHas('stars', function ($q) use ($actor) {
            $q->where('user_id', $actor->id);
        })
        ->with(['user', 'channel'])
        ->orderBy('id', 'desc')
        ->limit(100)
        ->get();

        $data = $messages->map(fn($msg) => ResponseFormatter::formatTextChannelMessage($msg, $actor))->values()->toArray();

        return new JsonResponse(['data' => $data]);
    }
}