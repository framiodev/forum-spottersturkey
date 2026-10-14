<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Flarum\Foundation\Paths;

class UploadStoryBackgroundController implements RequestHandlerInterface
{
    protected Paths $paths;

    public function __construct(Paths $paths)
    {
        $this->paths = $paths;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        $uploadedFiles = $request->getUploadedFiles();
        $file = $uploadedFiles['file'] ?? null;

        if (!$file || $file->getError() !== UPLOAD_ERR_OK) {
            return new JsonResponse(['error' => 'Dosya yüklenemedi veya geçersiz.'], 400);
        }

        $clientFilename = $file->getClientFilename();
        $ext = strtolower(pathinfo($clientFilename, PATHINFO_EXTENSION));

        $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm'];
        if (!in_array($ext, $allowedExtensions)) {
            return new JsonResponse(['error' => 'Desteklenmeyen dosya formatı. (.jpg, .png, .webp, .mp4, .webm desteklenir)'], 400);
        }

        $targetDir = $this->paths->public . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'backgrounds';
        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0775, true);
        }

        $isVideo = in_array($ext, ['mp4', 'webm']);
        $prefix = $isVideo ? 'story_video_' : 'story_bg_';
        $filename = $prefix . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $targetPath = $targetDir . DIRECTORY_SEPARATOR . $filename;

        try {
            $file->moveTo($targetPath);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => 'Dosya kaydedilemedi: ' . $e->getMessage()], 500);
        }

        $url = '/assets/backgrounds/' . $filename;

        return new JsonResponse([
            'success' => true,
            'url' => $url,
            'filename' => $filename,
            'type' => $isVideo ? 'video' : 'image',
            'suggestedName' => pathinfo($clientFilename, PATHINFO_FILENAME)
        ]);
    }
}
