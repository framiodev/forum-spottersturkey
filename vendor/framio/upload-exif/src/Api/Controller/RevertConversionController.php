<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Framio\UploadExif\Database\FramioImage;
use Framio\UploadExif\Storage\CloudStorage;
use Framio\UploadExif\Storage\UrlVariants;
use Framio\UploadExif\Storage\PostImageUrlRepair;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Format dönüştürücünün günlüğünü listeler (GET) ve dönüştürmeleri geri alır (POST).
 * Geri alma: görsel kaydı eski haline döner, gönderilerdeki adresler geri çevrilir; eski dosyalar
 * buluttan silinmemişse yeni dosyalar silinir. Eski dosyaları silinmiş dönüşümler geri alınamaz.
 */
class RevertConversionController implements RequestHandlerInterface
{
    public function __construct(protected ConnectionInterface $db, protected CloudStorage $cloud)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        if ($request->getMethod() === 'GET') {
            $runs = $this->db->table('framio_media_conversions')
                ->selectRaw('run, count(*) as images, sum(old_deleted) as unrecoverable, min(created_at) as started_at')
                ->groupBy('run')->orderByDesc('started_at')->get();

            return new JsonResponse(['runs' => $runs]);
        }

        $body = (array) $request->getParsedBody();
        $run = (string) Arr::get($body, 'run', '');
        $limit = max(1, min(50, (int) Arr::get($body, 'limit', 20)));
        $deleteNew = (bool) Arr::get($body, 'delete_new', true);

        if (Arr::get($body, 'action') === 'purge') {
            return $this->purge($run, $limit);
        }
        if (Arr::get($body, 'action') === 'repair') {
            return $this->repairAll((int) Arr::get($body, 'after_id', 0), $limit);
        }

        $rows = $this->db->table('framio_media_conversions')
            ->when($run !== '', fn ($q) => $q->where('run', $run))
            ->where('old_deleted', false)
            ->orderByDesc('id')->take($limit)->get();

        $bucket = ($deleteNew && $this->cloud->isConfigured()) ? $this->cloud->bucket() : null;
        $reverted = 0;
        $failed = [];

        foreach ($rows as $row) {
            try {
                $this->db->transaction(function () use ($row) {
                    $before = json_decode($row->before, true);
                    $image = FramioImage::find($row->image_id);
                    if ($image) {
                        $image->forceFill($before)->save();
                    }

                    // Yeni günlük biçimi {forward, inverse}; eski biçimde yalnızca ileri eşleme tutuluyordu
                    $map = json_decode($row->replacements, true) ?: [];
                    $inverse = isset($map['inverse']) ? $map['inverse'] : array_flip($map);
                    if ($inverse) {
                        foreach (Post::query()->whereIn('id', json_decode($row->post_ids, true) ?: [])->cursor() as $post) {
                            $raw = $post->getRawOriginal('content');
                            $new = strtr($raw, $inverse);
                            if ($new !== $raw) Post::query()->whereKey($post->id)->update(['content' => $new]);
                        }
                    }

                    $this->db->table('framio_media_conversions')->where('id', $row->id)->delete();
                });

                if ($bucket) {
                    $old = json_decode($row->old_objects, true) ?: [];
                    foreach (json_decode($row->new_objects, true) ?: [] as $name) {
                        if (in_array($name, $old, true)) continue; // aynı adlı nesneye dokunma
                        try {
                            $bucket->object($name)->delete();
                        } catch (\Throwable $e) {
                            // yeni dosya kalırsa yalnızca yer kaplar
                        }
                    }
                }
                $reverted++;
            } catch (\Throwable $e) {
                $failed[] = ['id' => $row->image_id, 'reason' => $e->getMessage()];
            }
        }

        $remaining = $this->db->table('framio_media_conversions')
            ->when($run !== '', fn ($q) => $q->where('run', $run))
            ->where('old_deleted', false)->count();

        return new JsonResponse([
            'reverted' => $reverted,
            'failed' => $failed,
            'remaining' => $remaining,
            'completed' => $remaining === 0 || $rows->isEmpty(),
            'message' => "{$reverted} görsel eski haline döndürüldü. Kalan: {$remaining}",
        ]);
    }

    /**
     * Doğrulanmış bir dönüştürmenin eski dosyalarını (eski ana görsel, thumb_ ve mini_ kopyaları) buluttan kalıcı olarak siler.
     * Bu adımdan sonra o dönüştürme geri alınamaz.
     */
    protected function purge(string $run, int $limit): ResponseInterface
    {
        if ($run === '') {
            return new JsonResponse(['error' => 'Temizlenecek dönüştürme seçilmedi.'], 422);
        }

        $rows = $this->db->table('framio_media_conversions')
            ->where('run', $run)->where('old_deleted', false)
            ->orderBy('id')->take($limit)->get();

        $bucket = $this->cloud->bucket();
        $deleted = 0;
        $failed = [];

        $repaired = 0;
        $skipped = [];
        $repair = resolve(PostImageUrlRepair::class);

        foreach ($rows as $row) {
            $keep = json_decode($row->new_objects, true) ?: [];
            $stillUsed = [];
            if ($image = FramioImage::find($row->image_id)) {
                $repaired += count($repair->repair($image));
                // Onarımdan sonra hâlâ eski adres varsa bu görselin eski dosyalarına dokunulmaz
                if ($repair->hasStaleReferences($image)) $stillUsed = json_decode($row->old_objects, true) ?: [];
            }
            foreach (json_decode($row->old_objects, true) ?: [] as $name) {
                if (in_array($name, $keep, true)) continue; // yeni dosyayla aynı adlı nesneye dokunma
                if (in_array($name, $stillUsed, true)) { // gönderide hâlâ kullanılıyor: silinmez
                    $skipped[] = ['id' => $row->image_id, 'file' => basename($name)];
                    continue;
                }
                try {
                    $object = $bucket->object($name);
                    if ($object->exists()) {
                        $object->delete();
                        $deleted++;
                    }
                } catch (\Throwable $e) {
                    $failed[] = ['id' => $row->image_id, 'reason' => $e->getMessage()];
                }
            }
            $this->db->table('framio_media_conversions')->where('id', $row->id)->update(['old_deleted' => true]);
        }

        $remaining = $this->db->table('framio_media_conversions')->where('run', $run)->where('old_deleted', false)->count();

        return new JsonResponse([
            'deleted' => $deleted,
            'repaired' => $repaired,
            'skipped' => $skipped,
            'failed' => $failed,
            'remaining' => $remaining,
            'completed' => $remaining === 0 || $rows->isEmpty(),
            'message' => "{$deleted} eski dosya buluttan silindi, {$repaired} gönderi onarıldı" . ($skipped ? ', ' . count($skipped) . ' dosya hâlâ kullanıldığı için korundu' : '') . ". Kalan görsel: {$remaining}",
        ]);
    }
    /**
     * Bulut görsellerinin hepsi için gönderilerde kalmış eski adresleri onarır (kimlik sırasıyla, parça parça).
     */
    protected function repairAll(int $afterId, int $limit): ResponseInterface
    {
        $repair = resolve(PostImageUrlRepair::class);
        $images = FramioImage::where('id', '>', $afterId)->where('path', 'like', 'http%')->orderBy('id')->take($limit)->get();

        $posts = 0;
        $stale = [];
        foreach ($images as $image) {
            $afterId = $image->id;
            $posts += count($repair->repair($image));
            if ($repair->hasStaleReferences($image)) $stale[] = ['id' => $image->id, 'file' => $image->filename];
        }

        $remaining = FramioImage::where('id', '>', $afterId)->where('path', 'like', 'http%')->count();

        return new JsonResponse([
            'repaired' => $posts,
            'stale' => $stale,
            'next_after_id' => $afterId,
            'remaining' => $remaining,
            'completed' => $remaining === 0,
            'message' => "{$posts} gönderi onarıldı. Kalan görsel: {$remaining}",
        ]);
    }
}
