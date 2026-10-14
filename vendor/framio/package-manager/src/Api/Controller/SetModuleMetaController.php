<?php

namespace Framio\PackageManager\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\PackageManager\Services\BundleManager;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class SetModuleMetaController implements RequestHandlerInterface
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
        $originalPackage = trim($body['original_package'] ?? '');
        $version = !empty($body['version']) ? trim($body['version']) : null;

        if (empty($bundle) || empty($module) || empty($originalPackage)) {
            return new JsonResponse(['error' => 'Paket, modül ve orijinal paket adı zorunludur.'], 400);
        }

        try {
            $result = $this->bundleManager->setModuleMeta($bundle, $module, $originalPackage, $version);
            return new JsonResponse([
                'status' => 'success',
                'meta' => $result,
                'message' => 'Modül paket kaynağı başarıyla kaydedildi.'
            ]);
        } catch (\Throwable $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }
}
