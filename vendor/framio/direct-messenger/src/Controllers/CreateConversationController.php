<?php

namespace Framio\DirectMessenger\Controllers;

use Flarum\Http\RequestUtil;
use Framio\DirectMessenger\Conversation;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Illuminate\Support\Arr;
use Flarum\User\User;

class CreateConversationController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $data = Arr::get($request->getParsedBody(), 'data', []);

        $recipientId = Arr::get($data, 'attributes.recipientId');
        $recipientIds = Arr::get($data, 'attributes.recipientIds', []);

        if ($recipientId) {
            $recipientIds[] = $recipientId;
        }

        $recipientIds = array_unique($recipientIds);

        if (empty($recipientIds)) {
            return new JsonResponse(['error' => 'En az bir kullanıcı seçilmelidir.'], 422);
        }

        // 1-on-1 sohbet ise var olanı kontrol et
        if (count($recipientIds) === 1) {
            $recId = $recipientIds[0];
            $recipient = User::findOrFail($recId);

            $existing = Conversation::whereHas('users', function ($q) use ($actor) {
                $q->where('user_id', $actor->id);
            })->whereHas('users', function ($q) use ($recipient) {
                $q->where('user_id', $recipient->id);
            })->withCount('users')->having('users_count', 2)->first();

            if ($existing) {
                return new JsonResponse([
                    'data' => ResponseFormatter::formatConversation($existing, $actor)
                ]);
            }
        }

        $conversation = Conversation::build();

        // Eğer grup ise başlık eklenebilir
        $title = Arr::get($data, 'attributes.title');
        if ($title) {
            $conversation->title = $title;
        }

        $conversation->save();

        $allIds = array_merge([$actor->id], $recipientIds);
        $allIds = array_unique($allIds);

        $conversation->users()->attach($allIds);

        return new JsonResponse([
            'data' => ResponseFormatter::formatConversation($conversation, $actor)
        ], 201);
    }
}

