<?php

namespace Framio\CustomHomepage\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\CustomHomepage\Support\GalleryPosts;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/** POST /api/framio/homepage-cache/flush — yalnızca admin */
class FlushCacheController implements RequestHandlerInterface
{
    public function __construct(protected GalleryPosts $gallery)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();
        $this->gallery->flush();

        return new JsonResponse(['ok' => true]);
    }
}
