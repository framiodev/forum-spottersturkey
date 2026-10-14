<?php

namespace Framio\DirectMessenger\Controllers;

use Flarum\Http\RequestUtil;
use Framio\DirectMessenger\TextChannelMessage;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Illuminate\Support\Arr;
use Carbon\Carbon;

class TextChannelMessageActionsController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if (!$actor || $actor->isGuest()) {
            return new JsonResponse(['error' => 'Giriş yapmalısınız.'], 401);
        }

        $id = (int) Arr::get($request->getQueryParams(), 'id');
        $message = TextChannelMessage::findOrFail($id);

        $path = $request->getUri()->getPath();

        // 1. STAR TOGGLE
        if (str_ends_with($path, '/star')) {
            $isStarred = $message->stars()->where('user_id', $actor->id)->exists();
            if ($isStarred) {
                $message->stars()->detach($actor->id);
            } else {
                $message->stars()->attach($actor->id, ['created_at' => Carbon::now()]);
            }
            $message->load(['user', 'channel']);
            return new JsonResponse(['data' => ResponseFormatter::formatTextChannelMessage($message, $actor)]);
        }

        $method = $request->getMethod();

        // 2. EDIT MESSAGE
        if ($method === 'PATCH' || $method === 'PUT') {
            if ($message->user_id !== $actor->id && !$actor->isAdmin()) {
                return new JsonResponse(['error' => 'Bu mesajı düzenleme yetkiniz yok.'], 403);
            }

            $body = (array) $request->getParsedBody();
            $content = trim(Arr::get($body, 'message', Arr::get($body, 'content', '')));

            if (empty($content)) {
                return new JsonResponse(['error' => 'Mesaj boş olamaz.'], 400);
            }

            $message->message = $content;
            $message->updated_at = Carbon::now();
            $message->save();

            $message->load(['user', 'channel']);
            return new JsonResponse(['data' => ResponseFormatter::formatTextChannelMessage($message, $actor)]);
        }

        // 3. DELETE MESSAGE
        if ($method === 'DELETE') {
            if ($message->user_id !== $actor->id && !$actor->isAdmin()) {
                return new JsonResponse(['error' => 'Bu mesajı silme yetkiniz yok.'], 403);
            }

            $message->deleted_at = Carbon::now();
            $message->save();

            $message->load(['user', 'channel']);
            return new JsonResponse(['data' => ResponseFormatter::formatTextChannelMessage($message, $actor)]);
        }

        return new JsonResponse(['error' => 'Geçersiz istek.'], 405);
    }
}