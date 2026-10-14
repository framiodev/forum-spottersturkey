<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Flarum\Foundation\Paths;

class StoryArchiveController implements RequestHandlerInterface
{
    protected Paths $paths;

    public function __construct(Paths $paths)
    {
        $this->paths = $paths;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $method = $request->getMethod();
        $dir = $this->paths->public . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'stories';

        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        // 1. GET: Admin panelinde arsivdeki tm hikayeleri listele
        if ($method === 'GET') {
            $actor->assertAdmin();

            $stories = [];
            foreach (glob($dir . DIRECTORY_SEPARATOR . '*.*') as $file) {
                if (!is_file($file)) continue;

                $filename = basename($file);
                $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm'])) continue;

                $stories[] = [
                    'filename' => $filename,
                    'url' => '/assets/stories/' . $filename,
                    'type' => in_array($ext, ['mp4', 'webm']) ? 'video' : 'image',
                    'size' => filesize($file),
                    'created_at' => date('Y-m-d H:i:s', filemtime($file)),
                    'timestamp' => filemtime($file)
                ];
            }

            // Yeniden eskiye srala
            usort($stories, function($a, $b) {
                return $b['timestamp'] - $a['timestamp'];
            });

            return new JsonResponse(['success' => true, 'stories' => $stories]);
        }

        // 2. POST: Hikaye Kaydetme veya Silme
        $body = $request->getParsedBody() ?? [];
        $action = $body['action'] ?? 'save';

        // Silme islemi (Admin)
        if ($action === 'delete') {
            $actor->assertAdmin();
            $filename = basename($body['filename'] ?? '');

            if (!$filename) {
                return new JsonResponse(['error' => 'Dosya adi belirtilmedi.'], 400);
            }

            $filePath = $dir . DIRECTORY_SEPARATOR . $filename;
            if (file_exists($filePath)) {
                @unlink($filePath);
                return new JsonResponse(['success' => true, 'message' => 'Hikaye basariyla silindi.']);
            }

            return new JsonResponse(['error' => 'Dosya bulunamadi.'], 404);
        }

        // Kaydetme islemi
        $actor->assertRegistered();

        $uploadedFiles = $request->getUploadedFiles();
        $file = $uploadedFiles['file'] ?? null;

        if ($file && $file->getError() === UPLOAD_ERR_OK) {
            $clientName = $file->getClientFilename();
            $ext = strtolower(pathinfo($clientName, PATHINFO_EXTENSION));
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm'])) {
                return new JsonResponse(['error' => 'Gecersiz dosya formati.'], 400);
            }

            $prefix = in_array($ext, ['mp4', 'webm']) ? 'story_video_' : 'story_img_';
            $targetName = $prefix . date('Ymd_His') . '_' . bin2hex(random_bytes(3)) . '.' . $ext;
            $targetPath = $dir . DIRECTORY_SEPARATOR . $targetName;

            $file->moveTo($targetPath);

            $mimeType = in_array($ext, ['mp4', 'webm']) ? 'video/mp4' : 'image/jpeg';
            $publicUrl = $this->getPublicStorageUrl($targetPath, $targetName, $mimeType);

            return new JsonResponse([
                'success' => true,
                'filename' => $targetName,
                'url' => $publicUrl,
                'local_url' => '/assets/stories/' . $targetName
            ]);
        }

        // Base64 Data URL destegi
        $imageData = $body['image_data'] ?? null;
        if ($imageData && preg_match('/^data:image\/(\w+);base64,/', $imageData)) {
            $data = substr($imageData, strpos($imageData, ',') + 1);
            $decoded = base64_decode($data);

            if ($decoded === false) {
                return new JsonResponse(['error' => 'Base64 cozulemedi.'], 400);
            }

            $targetName = 'story_img_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3)) . '.jpg';
            $targetPath = $dir . DIRECTORY_SEPARATOR . $targetName;

            file_put_contents($targetPath, $decoded);

            $publicUrl = $this->getPublicStorageUrl($targetPath, $targetName, 'image/jpeg');

            return new JsonResponse([
                'success' => true,
                'filename' => $targetName,
                'url' => $publicUrl,
                'local_url' => '/assets/stories/' . $targetName
            ]);
        }

        return new JsonResponse(['error' => 'Gecersiz yukleme verisi.'], 400);
    }

    protected function getPublicStorageUrl(string $localPath, string $filename, string $mimeType): string
    {
        $firebaseKey = $this->paths->base . DIRECTORY_SEPARATOR . 'firebase-key.json';
        if (file_exists($firebaseKey) && class_exists(\Google\Cloud\Storage\StorageClient::class)) {
            try {
                $storage = new \Google\Cloud\Storage\StorageClient(['keyFilePath' => $firebaseKey]);
                $bucket = $storage->bucket('ulasim-arsiv-forum-storage.firebasestorage.app');
                $cloudPath = 'assets/stories/' . $filename;
                $bucket->upload(fopen($localPath, 'r'), [
                    'name' => $cloudPath,
                    'predefinedAcl' => 'publicRead',
                    'metadata' => [
                        'contentType' => $mimeType,
                        'contentDisposition' => 'inline; filename="' . $filename . '"'
                    ]
                ]);
                return 'https://images.ulasimarsiv.com/' . $cloudPath;
            } catch (\Throwable $e) {
                // GCS upload failure fallback
            }
        }
        return '/assets/stories/' . $filename;
    }
}
