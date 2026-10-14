<?php

namespace Framio\PackageManager\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\PackageManager\Services\BundleManager;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class CheckUpdateController implements RequestHandlerInterface
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

        $params = $request->getQueryParams();
        $bundle = trim($params['bundle'] ?? '');
        $module = trim($params['module'] ?? '');

        if (empty($bundle) || empty($module)) {
            return new JsonResponse(['error' => 'Paket ve modül parametreleri zorunludur.'], 400);
        }

        try {
            $result = $this->bundleManager->checkModuleUpdate($bundle, $module);
            return new JsonResponse($result);
        } catch (\Throwable $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }
}
