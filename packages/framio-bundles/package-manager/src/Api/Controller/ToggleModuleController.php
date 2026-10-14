<?php

namespace Framio\PackageManager\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\PackageManager\Services\BundleManager;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class ToggleModuleController implements RequestHandlerInterface
{
    private BundleManager $bundleManager;

    public function __construct(BundleManager $bundleManager)
    {
        $this->bundleManager = $bundleManager;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        $body = $request->getParsedBody();
        $key = trim($body['key'] ?? '');
        $enabled = (bool)($body['enabled'] ?? false);

        if (empty($key)) {
            return new JsonResponse(['error' => 'Modül anahtarı gereklidir.'], 400);
        }

        $this->bundleManager->toggleModule($key, $enabled);

        return new JsonResponse([
            'status' => 'success',
            'key' => $key,
            'enabled' => $enabled
        ]);
    }
}
