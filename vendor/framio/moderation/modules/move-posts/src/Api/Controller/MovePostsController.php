<?php

/*
 * This file is part of fof/move-posts.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\MovePosts\Api\Controller;

use Flarum\Api\JsonApi;
use Flarum\Http\RequestUtil;
use FoF\MovePosts\Command\MovePosts;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class MovePostsController implements RequestHandlerInterface
{
    public function __construct(
        protected Dispatcher $bus,
        protected JsonApi $api
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $data = Arr::get($request->getParsedBody(), 'data', []);

        $result = $this->bus->dispatch(new MovePosts($actor, $data, false));

        return new JsonResponse([
            'status' => $result['status'],
            'postCount' => $result['postCount'],
            'firstMovedPostNumber' => $result['firstMovedPostNumber'],
            'sourceDiscussionId' => (string) $result['sourceDiscussion']->id,
            'targetDiscussionId' => (string) $result['targetDiscussion']->id,
        ]);
    }
}
