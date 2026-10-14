<?php

namespace Framio\CustomHomepage\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\CustomHomepage\Support\GalleryPosts;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * GET /api/framio/homepage-posts            → ana sayfa galerisi
 * GET /api/framio/category-posts?tag=&sort= → kategori galerisi / akışı
 *
 * Yanıt JSON:API biçimindedir (data/included/meta.spotterExifMap); ön yüz
 * bileşenleri bu biçimi bekler.
 */
class GalleryPostsController implements RequestHandlerInterface
{
    public function __construct(protected GalleryPosts $gallery)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $params = $request->getQueryParams();
        $isCategory = str_ends_with($request->getUri()->getPath(), '/category-posts');

        return new JsonResponse($this->gallery->document(
            $actor,
            $request,
            $isCategory ? (string) Arr::get($params, 'tag', '') : null,
            $isCategory && Arr::get($params, 'sort') === 'popular'
        ));
    }
}
