<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Intervention\Image\ImageManager;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Illuminate\Support\Str;
use Throwable;

class UploadWatermarkedController implements RequestHandlerInterface
{
    protected $settings;
    protected $tempPath;

    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
        $this->tempPath = public_path('assets/social-temp');
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        try {
            $actor = RequestUtil::getActor($request);
            $actor->assertRegistered();

            @ini_set('memory_limit', '512M');
            @ini_set('max_execution_time', 300);

            $files = $request->getUploadedFiles();
            $file = $files['spotter_image'] ?? null;
            $body = $request->getParsedBody();

            if (!$file || $file->getError() !== UPLOAD_ERR_OK) {
                return new JsonResponse(['error' => 'Dosya yüklenemedi veya geçersiz.'], 400);
            }

            if (!is_dir($this->tempPath)) {
                if (!mkdir($this->tempPath, 0755, true)) {
                    throw new \Exception("Geçici klasör oluşturulamadı: " . $this->tempPath);
                }
            } else {
                // Otomatik Temizlik: 24 saatten eski geçici sosyal medya fotoğraflarını sil
                foreach (glob($this->tempPath . '/*') as $tempFile) {
                    if (is_file($tempFile) && (time() - filemtime($tempFile) > 86400)) {
                        @unlink($tempFile);
                    }
                }
            }

            $watermarkFilename = $body['watermark_type'] ?? 'none';
            $targetUsername = $body['target_username'] ?? null;
            $targetWmType = $body['target_watermark_type'] ?? 'yatay';
            $customFilenameInput = $body['custom_filename'] ?? null;

            $clientFilename = $file->getClientFilename();
            $baseName = !empty($customFilenameInput) ? trim($customFilenameInput) : pathinfo($clientFilename, PATHINFO_FILENAME);
            $asciiName = Str::ascii($baseName);
            $safeName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $asciiName);
            $safeName = preg_replace('/_+/', '_', $safeName);
            $uniqueSuffix = '_' . time() . '_' . Str::random(6);
            $finalFilename = $safeName . $uniqueSuffix . '.jpg';
            $localFullPath = $this->tempPath . '/' . $finalFilename;

            $file->moveTo($localFullPath);

            $driverObj = extension_loaded('imagick') ? new \Intervention\Image\Drivers\Imagick\Driver() : new \Intervention\Image\Drivers\Gd\Driver();
            $manager = new ImageManager($driverObj);

            $img = $manager->read($localFullPath);
            
            // 4K (3840px max width/height)
            $img->scaleDown(width: 3840, height: 3840);

            // Filigran / Watermark Uygula
            $shouldApplyWatermark = ($watermarkFilename !== 'none' && !empty($watermarkFilename)) || ($actor->isAdmin() && !empty($targetUsername));

            if ($shouldApplyWatermark) {
                $baseWmDir = public_path('assets/watermarks');
                $validWmPath = null;

                if ($actor->isAdmin() && !empty($targetUsername)) {
                    $targetUserClean = trim($targetUsername);
                    $suffix = ($targetWmType === 'dikey') ? '_dikey_wm.png' : '_yatay_wm.png';
                    $candidatePath = $baseWmDir . '/' . $targetUserClean . '/' . $targetUserClean . $suffix;
                    if (file_exists($candidatePath)) {
                        $validWmPath = $candidatePath;
                    }
                } elseif ($watermarkFilename !== 'none') {
                    $userWmPath = $baseWmDir . '/' . $actor->username . '/' . $watermarkFilename;
                    $defaultWmPath = $baseWmDir . '/global/' . $watermarkFilename;
                    if (file_exists($userWmPath)) {
                        $validWmPath = $userWmPath;
                    } elseif (file_exists($defaultWmPath)) {
                        $validWmPath = $defaultWmPath;
                    }
                }

                if ($validWmPath && file_exists($validWmPath)) {
                    $wm = $manager->read($validWmPath);
                    $targetWidth = $img->width();
                    $wm->scaleDown(width: $targetWidth);
                    $img->place($wm, 'bottom');
                    unset($wm);
                }
            }

            $img->save($localFullPath, quality: 92);
            unset($img);

            $baseUrl = rtrim(app()->url(), '/');
            $fullUrl = $baseUrl . '/assets/social-temp/' . $finalFilename;

            return new JsonResponse([
                'success' => true,
                'url' => $fullUrl,
                'filename' => $finalFilename
            ]);

        } catch (Throwable $e) {
            return new JsonResponse([
                'error' => 'Görsel işlenirken bir hata oluştu: ' . $e->getMessage()
            ], 500);
        }
    }
}
