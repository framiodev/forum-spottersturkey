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

class DeleteMessageController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $id = Arr::get($request->getQueryParams(), 'id');
        $message = Message::findOrFail($id);

        $isParticipant = $message->conversation && $message->conversation->users()->where('users.id', $actor->id)->exists();

        // Allow delete if sender, admin, or if it's a meeting_invite in an active conversation (to end call)
        if ($message->user_id !== $actor->id && !$actor->isAdmin() && !($message->type === 'meeting_invite' && $isParticipant)) {
            throw new PermissionDeniedException;
        }

        // Soft delete
        $message->deleted_at = Carbon::now();
        $message->save();

        $message->load(['user', 'replyTo']);

        return new JsonResponse([
            'data' => ResponseFormatter::formatMessage($message, $actor)
        ]);
    }
}

