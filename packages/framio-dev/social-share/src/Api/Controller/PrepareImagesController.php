<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\SocialShare\Services\SocialImagePreparer;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/** Paylaşım penceresinde görseller seçilince: tam boy, imzalı kopyalar Firebase'e hazırlanır */
class PrepareImagesController implements RequestHandlerInterface
{
    public function __construct(protected SocialImagePreparer $preparer)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertRegistered();
        $urls = array_slice(array_values(array_filter((array) Arr::get((array) $request->getParsedBody(), 'urls', []), 'is_string')), 0, 20);

        return new JsonResponse(['map' => $this->preparer->prepareMap($urls)]);
    }
}
