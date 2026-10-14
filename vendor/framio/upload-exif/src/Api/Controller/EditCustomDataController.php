<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\UploadExif\Database\FramioImage;
use Illuminate\Support\Arr;

class EditCustomDataController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $idsParam = Arr::get($request->getQueryParams(), 'id');
        $ids = array_filter(explode(',', $idsParam));

        if (empty($ids)) {
            return new JsonResponse(['error' => 'Geçerli bir görsel ID belirtilmedi.'], 400);
        }

        $images = FramioImage::whereIn('id', $ids)->get();
        if ($images->isEmpty()) {
            return new JsonResponse(['error' => 'Görseller bulunamadı.'], 404);
        }

        // Yetki kontrolü: Admin veya tüm görsellerin sahibi olmalı
        if (!$actor->isAdmin()) {
            foreach ($images as $img) {
                if ((int)$actor->id !== (int)$img->user_id) {
                    return new JsonResponse(['error' => 'Bu görselleri özelleştirme yetkiniz yok.'], 403);
                }
            }
        }

        $body = $request->getParsedBody();
        $customMusic = Arr::get($body, 'custom_music');
        $customGps = Arr::get($body, 'custom_gps');

        $musicJson = null;
        if (!empty($customMusic)) {
            $musicJson = is_string($customMusic) ? $customMusic : json_encode($customMusic);
        }

        foreach ($images as $img) {
            if ($customMusic !== null) {
                $img->music_data = $musicJson;
            }

            if ($customGps !== null) {
                $gpsData = is_string($customGps) ? json_decode($customGps, true) : $customGps;
                $exif = !empty($img->exif_data) ? (is_string($img->exif_data) ? json_decode($img->exif_data, true) : $img->exif_data) : [];
                
                if (!empty($gpsData) && isset($gpsData['lat']) && isset($gpsData['lon'])) {
                    $exif['lat'] = (float) $gpsData['lat'];
                    $exif['lon'] = (float) $gpsData['lon'];
                    $exif['GPSLatitude'] = (float) $gpsData['lat'];
                    $exif['GPSLongitude'] = (float) $gpsData['lon'];
                } else {
                    unset($exif['lat'], $exif['lon'], $exif['GPSLatitude'], $exif['GPSLongitude']);
                }
                $img->exif_data = json_encode($exif);
            }

            $img->save();
        }

        $first = $images->first();
        return new JsonResponse([
            'success' => true,
            'music_data' => $first->music_data ? json_decode($first->music_data, true) : null,
            'exif_data' => $first->exif_data ? json_decode($first->exif_data, true) : null,
        ]);
    }
}
