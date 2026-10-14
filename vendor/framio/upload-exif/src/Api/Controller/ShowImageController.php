<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\UploadExif\Database\FramioImage;
use Illuminate\Support\Arr;

class ShowImageController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $id = Arr::get($request->getQueryParams(), 'id');
        $image = FramioImage::find($id);
        if (!$image) {
            return new JsonResponse(['errors' => [['status' => '404', 'code' => 'not_found']]], 404);
        }

        $actor = RequestUtil::getActor($request);
        $data = $image->toArray();

        // Orijinal dosya güvenlik kontrolü: Yalnızca admin veya görselin sahibi görebilir
        $canSeeOriginal = $actor && ($actor->isAdmin() || (int)$actor->id === (int)$image->user_id);
        if (!$canSeeOriginal) {
            unset($data['original_path']);
        }

        $data['url'] = $data['path'];
        $data['thumb_url'] = $data['thumb_path'] ?: $data['path'];
        if (!empty($data['original_path'])) {
            $data['original_url'] = $data['original_path'];
        }
        if (!empty($data['exif_data']) && is_string($data['exif_data'])) {
            $data['exif_data'] = json_decode($data['exif_data'], true);
        }
        $data['exif'] = $data['exif_data'] ?: [];
        if (!empty($data['music_data']) && is_string($data['music_data'])) {
            $data['music_data'] = json_decode($data['music_data'], true);
        }
        $data['createdAt'] = $data['created_at'];

        return new JsonResponse($data);
    }
}
