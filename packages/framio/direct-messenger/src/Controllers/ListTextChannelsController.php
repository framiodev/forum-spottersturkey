<?php

namespace Framio\DirectMessenger\Controllers;

use Framio\DirectMessenger\TextChannel;
use Framio\DirectMessenger\ResponseFormatter;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Illuminate\Support\Arr;

class ListTextChannelsController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $discussionId = Arr::get($request->getQueryParams(), 'discussion_id');

        $query = TextChannel::where('is_active', true);

        if ($discussionId) {
            $query->where(function ($q) use ($discussionId) {
                $q->whereNull('discussion_id')->orWhere('discussion_id', $discussionId);
            });
        } else {
            $query->whereNull('discussion_id');
        }

        $channels = $query->orderBy('sort_order', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $data = $channels->map(fn($ch) => ResponseFormatter::formatTextChannel($ch))->values()->toArray();

        return new JsonResponse(['data' => $data]);
    }
}


