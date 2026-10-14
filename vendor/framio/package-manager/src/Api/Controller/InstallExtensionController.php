<?php

namespace Framio\PackageManager\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\PackageManager\Services\BundleManager;
use Framio\PackageManager\Services\PackageDownloader;
use Framio\PackageManager\Services\PackagistClient;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class InstallExtensionController implements RequestHandlerInterface
{
    private BundleManager $bundleManager;
    private PackagistClient $packagistClient;
    private PackageDownloader $downloader;

    public function __construct(
        BundleManager $bundleManager,
        PackagistClient $packagistClient,
        PackageDownloader $downloader
    ) {
        $this->bundleManager = $bundleManager;
        $this->packagistClient = $packagistClient;
        $this->downloader = $downloader;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        $body = $request->getParsedBody();
        $sourcePackage = trim($body['package'] ?? '');
        $mode = trim($body['mode'] ?? 'consolidate'); // 'consolidate', 'new_bundle', 'isolate'

        if (empty($sourcePackage)) {
            return new JsonResponse(['error' => 'Lütfen kurulacak eklenti paket adını belirtin (örn: fof/upload).'], 400);
        }

        // 1. Packagist'ten eklenti detaylarını ve indirme ZIP linkini al
        $details = $this->packagistClient->getPackageDetails($sourcePackage);
        if (!$details || empty($details['dist']['url'])) {
            return new JsonResponse([
                'error' => "'{$sourcePackage}' için Packagist üzerinde indirilebilir bir sürüm arşivi bulunamadı."
            ], 404);
        }

        $zipUrl = $details['dist']['url'];

        // 2. ZIP dosyasını indir
        $tempZip = $this->downloader->downloadZip($zipUrl);
        if (!$tempZip) {
            return new JsonResponse([
                'error' => "Eklenti arşivi indirilemedi: {$zipUrl}"
            ], 500);
        }

        try {
            if ($mode === 'consolidate') {
                $targetBundle = trim($body['target_bundle'] ?? 'widgets');
                $moduleKey = trim($body['module_key'] ?? '');
                if (empty($moduleKey)) {
                    $parts = explode('/', $sourcePackage);
                    $moduleKey = end($parts);
                }
                $moduleTitle = trim($body['module_title'] ?? ucwords(str_replace(['-', '_'], ' ', $moduleKey)));

                $result = $this->bundleManager->consolidateExtension($tempZip, $targetBundle, $moduleKey, $moduleTitle);
                return new JsonResponse([
                    'status' => 'success',
                    'mode' => 'consolidate',
                    'message' => "'{$moduleTitle}' eklentisi '{$targetBundle}' konsolide paketine başarıyla eklendi!",
                    'data' => $result
                ]);
            }

            if ($mode === 'new_bundle') {
                $bundleName = trim($body['bundle_name'] ?? '');
                $bundleTitle = trim($body['bundle_title'] ?? '');
                $bundleDesc = trim($body['bundle_description'] ?? '');

                if (empty($bundleName)) {
                    return new JsonResponse(['error' => 'Yeni konsolide paket adı gereklidir.'], 400);
                }

                // Önce yeni paketi oluştur
                $bundleResult = $this->bundleManager->createBundle($bundleName, $bundleTitle, $bundleDesc);

                // Sonra eklentiyi bu yeni pakete modül olarak aktar
                $parts = explode('/', $sourcePackage);
                $moduleKey = end($parts);
                $result = $this->bundleManager->consolidateExtension($tempZip, $bundleResult['id'], $moduleKey, $sourcePackage);

                return new JsonResponse([
                    'status' => 'success',
                    'mode' => 'new_bundle',
                    'message' => "'{$bundleTitle}' konsolide paketi oluşturuldu ve '{$sourcePackage}' içine eklendi!",
                    'data' => $result
                ]);
            }

            if ($mode === 'isolate') {
                $identity = [
                    'package_name' => trim($body['custom_package_name'] ?? $sourcePackage),
                    'title' => trim($body['custom_title'] ?? ''),
                    'description' => trim($body['custom_description'] ?? ''),
                    'version' => trim($body['custom_version'] ?? '1.0.0'),
                    'author' => trim($body['custom_author'] ?? 'Framio-Dev'),
                    'icon_name' => trim($body['custom_icon_name'] ?? 'fas fa-puzzle-piece'),
                    'icon_bg' => trim($body['custom_icon_bg'] ?? '#0b5c4e'),
                    'icon_color' => trim($body['custom_icon_color'] ?? '#ffffff'),
                ];

                $result = $this->bundleManager->installIsolatedExtension($tempZip, $identity);
                return new JsonResponse([
                    'status' => 'success',
                    'mode' => 'isolate',
                    'message' => "'{$result['title']}' eklentisi izole kimlikle kuruldu!",
                    'data' => $result
                ]);
            }

            return new JsonResponse(['error' => 'Geçersiz kurulum modu.'], 400);
        } catch (\Throwable $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        } finally {
            @unlink($tempZip);
        }
    }
}
