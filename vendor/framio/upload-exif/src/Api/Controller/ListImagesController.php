<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Flarum\User\User;

class ListImagesController implements RequestHandlerInterface
{
    protected $db;

    public function __construct(ConnectionInterface $db)
    {
        $this->db = $db;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $filters = $request->getQueryParams()['filter'] ?? [];
        $path = $request->getUri()->getPath();

        $query = $this->db->table('framio_media_images')->select('framio_media_images.*');

        // Arama (Dosya adı veya Kullanıcı adı)
        if ($q = Arr::get($filters, 'q')) {
            $query->where(function ($sub) use ($q) {
                $sub->where('filename', 'like', "%{$q}%")
                    ->orWhereIn('user_id', function ($userSub) use ($q) {
                        $userSub->select('id')->from('users')->where('username', 'like', "%{$q}%");
                    });
            });
        }

        if (Arr::get($filters, 'has_original') === '1') {
            $query->whereNotNull('original_path');
        }

        // Belirli kullanıcı filtresi
        if ($userId = Arr::get($filters, 'user')) {
            $query->where('user_id', $userId);
        } elseif (strpos($path, '/all') !== false && $actor->isAdmin()) {
            // Admin panelinde tüm görseller
        } else {
            // Normal kullanıcı kendi galerisini listeler
            $actor->assertRegistered();
            $query->where('user_id', $actor->id);
        }

        $query->orderBy('id', 'desc');

        $defaultLimit = (strpos($path, '/all') !== false) ? 20 : 24;
        $limit = (int) Arr::get($request->getQueryParams(), 'page.limit', $defaultLimit);
        if ($limit <= 0 || $limit > 100) $limit = $defaultLimit;
        $offset = (int) Arr::get($request->getQueryParams(), 'page.offset', 0);

        $results = $query->limit($limit)->offset($offset)->get();

        // Orijinal dosya gizleme kontrolü
        $canSeeOriginal = $actor->isAdmin();
        $results = $results->map(function ($row) use ($canSeeOriginal, $actor) {
            $isOwner = $actor->id && ((int)$actor->id === (int)$row->user_id);
            if (!$canSeeOriginal && !$isOwner) {
                unset($row->original_path);
            }
            $row->url = $row->path;
            $row->thumb_url = $row->thumb_path ?: $row->path;
            if (!empty($row->original_path)) {
                $row->original_url = $row->original_path;
            }
            if (!empty($row->exif_data) && is_string($row->exif_data)) {
                $row->exif_data = json_decode($row->exif_data, true);
            }
            $row->exif = $row->exif_data ?: [];
            if (!empty($row->music_data) && is_string($row->music_data)) {
                $row->music_data = json_decode($row->music_data, true);
            }
            $row->createdAt = $row->created_at;
            return $row;
        });

        $this->loadUsersForResults($results);

        return new JsonResponse($results);
    }

    protected function loadUsersForResults($results)
    {
        $userIds = $results->pluck('user_id')->filter()->unique();
        if ($userIds->isEmpty()) return;

        $users = User::whereIn('id', $userIds)->get()->keyBy('id');

        foreach ($results as $item) {
            if ($item->user_id && isset($users[$item->user_id])) {
                $user = $users[$item->user_id];
                $item->user = [
                    'id' => $user->id,
                    'username' => $user->username,
                    'displayName' => $user->display_name,
                    'avatarUrl' => $user->avatar_url,
                ];
            } else {
                $item->user = null;
            }
        }
    }
}
