<?php

namespace Framio\CustomHomepage\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\CustomHomepage\Support\GalleryPosts;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/** GET /api/framio/latest-activity → "Son Gönderilen Mesajlar" tablosu (hafif, önbellekli) */
class LatestActivityController implements RequestHandlerInterface
{
    public function __construct(protected GalleryPosts $gallery)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        return new JsonResponse(['data' => $this->gallery->latest(RequestUtil::getActor($request))]);
    }
}
