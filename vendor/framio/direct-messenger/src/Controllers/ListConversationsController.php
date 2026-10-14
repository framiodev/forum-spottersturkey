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

class ListConversationsController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $filter = Arr::get($request->getQueryParams(), 'filter', []);
        $filterArchived = Arr::get($filter, 'is_archived');
        $filterStarred = Arr::get($filter, 'is_starred');

        $conversations = Conversation::whereHas('users', function ($query) use ($actor, $filterArchived, $filterStarred) {
            $query->where('user_id', $actor->id)
                  ->whereNull('conversation_user.deleted_at');

            if ($filterArchived !== null) {
                $query->where('conversation_user.is_archived', filter_var($filterArchived, FILTER_VALIDATE_BOOLEAN));
            } else {
                $query->where('conversation_user.is_archived', false);
            }

            if ($filterStarred !== null && filter_var($filterStarred, FILTER_VALIDATE_BOOLEAN)) {
                $query->where('conversation_user.is_starred', true);
            }
        })
        ->with(['users', 'lastMessage'])
        ->orderBy('updated_at', 'desc')
        ->get();

        $data = $conversations->map(fn($conv) => ResponseFormatter::formatConversation($conv, $actor))->values()->toArray();

        return new JsonResponse(['data' => $data]);
    }
}

