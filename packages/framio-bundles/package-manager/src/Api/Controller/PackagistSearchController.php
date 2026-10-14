<?php

namespace Framio\PackageManager\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\PackageManager\Services\PackagistClient;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class PackagistSearchController implements RequestHandlerInterface
{
    private PackagistClient $client;

    public function __construct(PackagistClient $client)
    {
        $this->client = $client;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        $params = $request->getQueryParams();
        $query = trim($params['q'] ?? '');
        $page = max(1, (int)($params['page'] ?? 1));

        $data = $this->client->search($query, $page);

        return new JsonResponse($data);
    }
}
