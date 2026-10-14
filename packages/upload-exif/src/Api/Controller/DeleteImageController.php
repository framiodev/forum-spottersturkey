<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\UploadExif\Database\FramioImage;
use Illuminate\Support\Arr;
use Framio\UploadExif\Storage\CloudStorage;
use Flarum\Settings\SettingsRepositoryInterface;

class DeleteImageController implements RequestHandlerInterface
{
    protected $settings;

    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $id = Arr::get($request->getQueryParams(), 'id');

        $image = FramioImage::findOrFail($id);

        if (!$actor->isAdmin() && (int)$actor->id !== (int)$image->user_id) {
            return new JsonResponse(['error' => 'Bu görseli silme yetkiniz yok.'], 403);
        }

        $target = Arr::get($request->getQueryParams(), 'target'); // 'original' veya null

        if ($target === 'original') {
            $this->deleteOriginalFromFirebase($image);
            $image->original_path = null;
            $image->save();
            return new JsonResponse(['success' => true, 'message' => 'Orijinal yedek silindi.']);
        }

        // Opsiyonel: Firebase'den silme işlemi
        $deleteFromCloud = (bool) $this->settings->get('framio-upload-exif.delete_from_storage_on_delete', false);
        if ($deleteFromCloud) {
            $this->deleteFromFirebase($image);
        }

        $image->delete();

        return new JsonResponse(['success' => true]);
    }

    protected function deleteFromFirebase(FramioImage $image)
    {
        $thumb = $image->thumb_path && !str_contains($image->thumb_path, '?') ? $image->thumb_path : null;
        $this->deleteObjects([$image->path, $thumb, $image->original_path]);
    }

    protected function deleteOriginalFromFirebase(FramioImage $image)
    {
        $this->deleteObjects([$image->original_path]);
    }

    /** Verilen adreslere karşılık gelen bulut nesnelerini siler (hata siteyi etkilemez) */
    protected function deleteObjects(array $urls): void
    {
        try {
            $cloud = resolve(CloudStorage::class);
            if (!$cloud->isConfigured()) return;
            $bucket = $cloud->bucket();

            foreach (array_unique(array_filter($urls)) as $url) {
                $name = $cloud->objectName($url);
                if (!$name) continue;
                $object = $bucket->object($name);
                if ($object->exists()) $object->delete();
            }
        } catch (\Throwable $e) {
            resolve('log')->warning('[framio-upload-exif] Bulut silme hatası: ' . $e->getMessage());
        }
    }
}
