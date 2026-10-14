<?php

namespace Framio\PackageManager\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\PackageManager\Services\BundleManager;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class CreateBundleController implements RequestHandlerInterface
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
        $name = trim($body['name'] ?? '');
        $title = trim($body['title'] ?? '');
        $description = trim($body['description'] ?? '');
        $iconName = trim($body['icon_name'] ?? 'fas fa-cubes');
        $iconBg = trim($body['icon_bg'] ?? '#0b5c4e');

        if (empty($name) || empty($title)) {
            return new JsonResponse(['error' => 'Paket adı ve başlığı zorunludur.'], 400);
        }

        try {
            $bundle = $this->bundleManager->createBundle($name, $title, $description, $iconName, $iconBg);
            return new JsonResponse([
                'status' => 'success',
                'message' => "'{$title}' paketi başarıyla oluşturuldu.",
                'bundle' => $bundle
            ]);
        } catch (\Throwable $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }
}
