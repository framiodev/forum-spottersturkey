<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\UploadExif\Database\MediaCityRoute;
use Illuminate\Support\Arr;

class SaveCityRoutesController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        $body = $request->getParsedBody();
        $action = Arr::get($body, 'action', 'save');

        if ($action === 'delete') {
            $id = Arr::get($body, 'id');
            MediaCityRoute::where('id', $id)->delete();
            return new JsonResponse(['success' => true]);
        }

        if ($action === 'delete_city') {
            $city = trim(Arr::get($body, 'city', ''));
            if ($city) {
                MediaCityRoute::where('city', $city)->delete();
            }
            return new JsonResponse(['success' => true]);
        }

        if ($action === 'update') {
            $id = Arr::get($body, 'id');
            $route = MediaCityRoute::findOrFail($id);
            if (isset($body['route_code'])) $route->route_code = trim($body['route_code']);
            if (isset($body['route_name'])) $route->route_name = trim($body['route_name']);
            if (isset($body['city'])) $route->city = trim($body['city']);
            $route->save();
            return new JsonResponse(['success' => true, 'data' => $route]);
        }

        if ($action === 'bulk_import' || $action === 'bulk_insert') {
            $city = trim(Arr::get($body, 'city', ''));
            $routes = Arr::get($body, 'routes', []);
            $overwrite = !empty($body['overwrite']);

            if (empty($city)) {
                return new JsonResponse(['error' => 'Şehir adı belirtilmedi.'], 400);
            }

            if ($overwrite) {
                MediaCityRoute::where('city', $city)->delete();
            }

            $imported = 0;
            $updated = 0;
            // Farklı kaynakların alan adları (ör. hat_no / hat_adi, line / name); satırda şehir varsa o kullanılır
            $pick = function (array $r, array $keys): string {
                foreach ($keys as $k) {
                    if (isset($r[$k]) && is_scalar($r[$k]) && trim((string) $r[$k]) !== '') return trim((string) $r[$k]);
                }
                return '';
            };
            foreach ($routes as $r) {
                if (is_string($r)) $r = ['route_name' => $r];
                if (!is_array($r)) continue;
                $code = $pick($r, ['route_code', 'code', 'hat_kodu', 'hat_no', 'hatNo', 'hat', 'line', 'line_code', 'number', 'no', 'kod']);
                $name = $pick($r, ['route_name', 'name', 'hat_adi', 'hatAdi', 'title', 'guzergah', 'güzergah', 'description', 'line_name']);
                $rowCity = $pick($r, ['city', 'sehir', 'şehir']) ?: $city;
                if (!empty($code) || !empty($name)) {
                    $item = MediaCityRoute::updateOrCreate(
                        ['city' => $rowCity, 'route_code' => $code],
                        ['route_name' => $name]
                    );
                    if ($item->wasRecentlyCreated) {
                        $imported++;
                    } else {
                        $updated++;
                    }
                }
            }
            return new JsonResponse([
                'success' => true,
                'message' => "{$imported} yeni hat eklendi, {$updated} hat güncellendi.",
                'imported_count' => $imported,
                'updated_count' => $updated
            ]);
        }

        if ($action === 'sanitize_city') {
            $city = trim(Arr::get($body, 'city', ''));
            $items = MediaCityRoute::where('city', $city)->get();
            $cleanedCount = 0;
            foreach ($items as $item) {
                $cleanedName = preg_replace('/^[:\-–|\s]+|[:\-–|\s]+$/u', '', $item->route_name ?? '');
                $cleanedCode = preg_replace('/^[:\-–|\s]+|[:\-–|\s]+$/u', '', $item->route_code ?? '');
                if ($item->route_name !== $cleanedName || $item->route_code !== $cleanedCode) {
                    $item->route_name = $cleanedName;
                    $item->route_code = $cleanedCode;
                    $item->save();
                    $cleanedCount++;
                }
            }
            return new JsonResponse(['success' => true, 'message' => "{$cleanedCount} hat ismi temizlendi."]);
        }

        if ($action === 'change_casing') {
            $city = trim(Arr::get($body, 'city', ''));
            $casing = Arr::get($body, 'casing', 'title');
            $items = MediaCityRoute::where('city', $city)->get();
            $changed = 0;
            foreach ($items as $item) {
                if ($casing === 'upper') {
                    $item->route_name = mb_strtoupper($item->route_name ?? '', 'UTF-8');
                } else {
                    $item->route_name = mb_convert_case($item->route_name ?? '', MB_CASE_TITLE, 'UTF-8');
                }
                $item->save();
                $changed++;
            }
            return new JsonResponse(['success' => true, 'message' => "{$changed} hat güncellendi."]);
        }

        $id = Arr::get($body, 'id');
        $data = [
            'city' => trim(Arr::get($body, 'city', '')),
            'route_code' => trim(Arr::get($body, 'route_code', '')),
            'route_name' => trim(Arr::get($body, 'route_name', '')),
        ];

        if ($id) {
            $route = MediaCityRoute::findOrFail($id);
            $route->update($data);
        } else {
            $route = MediaCityRoute::create($data);
        }

        return new JsonResponse(['success' => true, 'data' => $route]);
    }
}
