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
use Flarum\User\Exception\PermissionDeniedException;
use Carbon\Carbon;

class UpdateMessageController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $id = Arr::get($request->getQueryParams(), 'id');
        $message = Message::findOrFail($id);

        if ($message->user_id !== $actor->id) {
            throw new PermissionDeniedException;
        }

        $attributes = Arr::get($request->getParsedBody(), 'data.attributes', []);

        if (isset($attributes['content'])) {
            $message->content = $attributes['content'];
            $message->updated_at = Carbon::now();
        }

        $message->save();

        $message->load(['user', 'replyTo']);

        return new JsonResponse([
            'data' => ResponseFormatter::formatMessage($message, $actor)
        ]);
    }
}

