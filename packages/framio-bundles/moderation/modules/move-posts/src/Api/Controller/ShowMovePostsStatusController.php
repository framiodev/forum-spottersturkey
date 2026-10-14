<?php

namespace FoF\MovePosts\Api\Controller;

use Flarum\Http\RequestUtil;
use FoF\MovePosts\Command\MovePosts;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class ShowMovePostsStatusController implements RequestHandlerInterface
{
    public function __construct(
        protected Dispatcher $bus
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $data = Arr::get($request->getParsedBody(), 'data', []);

        $status = $this->bus->dispatch(
            new MovePosts($actor, $data, true)
        );

        return new JsonResponse(['status' => $status], 200);
    }
}
