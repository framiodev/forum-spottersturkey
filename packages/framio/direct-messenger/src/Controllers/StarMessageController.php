<?php

namespace Framio\DirectMessenger\Controllers;

use Flarum\Http\RequestUtil;
use Framio\DirectMessenger\Message;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Illuminate\Support\Arr;
use Carbon\Carbon;

class StarMessageController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $id = Arr::get($request->getQueryParams(), 'id');
        $message = Message::findOrFail($id);

        $isStarred = $message->stars()->where('user_id', $actor->id)->exists();

        if ($isStarred) {
            $message->stars()->detach($actor->id);
        } else {
            $message->stars()->attach($actor->id, ['created_at' => Carbon::now()]);
        }

        $message->load(['user', 'replyTo']);

        return new JsonResponse([
            'data' => ResponseFormatter::formatMessage($message, $actor)
        ]);
    }
}

