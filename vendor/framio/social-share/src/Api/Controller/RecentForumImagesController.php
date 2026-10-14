<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Discussion\Discussion;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Illuminate\Database\Capsule\Manager as DB;
use Throwable;

class RecentForumImagesController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        try {
            $actor = RequestUtil::getActor($request);
            $actor->assertRegistered();

            $params = $request->getQueryParams();
            $query = trim($params['q'] ?? '');
            $limit = min(max((int)($params['limit'] ?? 30), 1), 60);

            $db = resolve('flarum.db');

            $builder = $db->table('spotter_images')
                ->leftJoin('users', 'spotter_images.user_id', '=', 'users.id')
                ->select([
                    'spotter_images.id',
                    'spotter_images.filename',
                    'spotter_images.path',
                    'spotter_images.thumb_path',
                    'spotter_images.created_at',
                    'users.username',
                    'users.nickname'
                ])
                ->whereNotNull('spotter_images.path')
                ->where('spotter_images.path', '!=', '')
                ->orderBy('spotter_images.id', 'desc')
                ->limit($limit);

            if (!empty($query)) {
                $builder->where(function ($q) use ($query) {
                    $q->where('spotter_images.filename', 'like', "%{$query}%")
                      ->orWhere('users.username', 'like', "%{$query}%")
                      ->orWhere('users.nickname', 'like', "%{$query}%");
                });
            }

            $rows = $builder->get();

            $images = [];
            foreach ($rows as $row) {
                $thumbUrl = $row->thumb_path ?: $row->path;
                $miniUrl = str_replace('thumb_', 'mini_', $thumbUrl);

                $images[] = [
                    'id' => $row->id,
                    'url' => $row->path,
                    'thumb' => $thumbUrl,
                    'mini' => $miniUrl,
                    'filename' => $row->filename ?: 'Görsel #' . $row->id,
                    'author' => $row->nickname ?: $row->username ?: 'Bilinmiyor',
                    'created_at' => $row->created_at
                ];
            }

            return new JsonResponse([
                'success' => true,
                'images' => $images
            ]);

        } catch (Throwable $e) {
            return new JsonResponse([
                'error' => 'Görseller alınamadı: ' . $e->getMessage()
            ], 500);
        }
    }
}
