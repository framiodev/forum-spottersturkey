<?php

namespace Framio\PackageManager\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\PackageManager\Services\BundleManager;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class DeleteModuleController implements RequestHandlerInterface
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
        $bundle = trim($body['bundle'] ?? '');
        $module = trim($body['module'] ?? '');

        if (empty($bundle) || empty($module)) {
            return new JsonResponse(['error' => 'Paket ve modül adı zorunludur.'], 400);
        }

        try {
            $this->bundleManager->deleteModule($bundle, $module);
            return new JsonResponse([
                'status' => 'success',
                'message' => "'{$module}' modülü başarıyla kaldırıldı."
            ]);
        } catch (\Throwable $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }
}
