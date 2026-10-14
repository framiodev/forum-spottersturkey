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

class UpdateConversationUserController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $id = Arr::get($request->getQueryParams(), 'id');
        $conversation = Conversation::whereHas('users', function ($query) use ($actor) {
            $query->where('user_id', $actor->id);
        })->findOrFail($id);

        $attributes = Arr::get($request->getParsedBody(), 'data.attributes', []);

        $pivotUpdate = [];

        if (isset($attributes['isStarred'])) {
            $pivotUpdate['is_starred'] = (bool) $attributes['isStarred'];
        }

        if (isset($attributes['isArchived'])) {
            $pivotUpdate['is_archived'] = (bool) $attributes['isArchived'];
        }

        if (isset($attributes['isDeleted'])) {
            $pivotUpdate['deleted_at'] = $attributes['isDeleted'] ? date('Y-m-d H:i:s') : null;
        }

        if (!empty($pivotUpdate)) {
            $conversation->users()->updateExistingPivot($actor->id, $pivotUpdate);
        }

        return new JsonResponse([
            'data' => ResponseFormatter::formatConversation($conversation, $actor)
        ]);
    }
}

