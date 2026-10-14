<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\UploadExif\Database\FramioImage;
use Framio\UploadExif\Storage\CloudStorage;
use Framio\UploadExif\Storage\UrlVariants;
use Framio\UploadExif\Storage\PostImageUrlRepair;
use Google\Cloud\Storage\Bucket;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Drivers\Imagick\Driver as ImagickDriver;
use Illuminate\Support\Arr;

/**
 * Bulut depodaki görselleri JPG ↔ WebP dönüştürür.
 *
 * Güvenli akış (görsel başına):
 *   1. Ana görsel, statik küçük görsel ve mini görsel yeni formatta yüklenir (orijinal yedek isteğe bağlı)
 *   2. Görsel kaydı ve bu görseli içeren gönderilerdeki adresler güncellenir
 *   3. Ancak bunlar başarılıysa eski dosyalar buluttan silinir
 * İlerleme kimlik numarasıyla (after_id) yapılır; başarısız görseller atlanır ve raporlanır, döngüye girmez.
 * dry_run=1 yalnızca sayım döndürür.
 */
class ConvertFormatController implements RequestHandlerInterface
{
    public function __construct(protected CloudStorage $cloud)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        $body = (array) $request->getParsedBody();
        $target = strtolower((string) Arr::get($body, 'target_format', 'webp'));
        $limit = max(1, min(25, (int) Arr::get($body, 'limit', 5)));
        $afterId = (int) Arr::get($body, 'after_id', 0);
        $withOriginals = (bool) Arr::get($body, 'include_originals', false);
        $keepOld = (bool) Arr::get($body, 'keep_old', true);
        $run = preg_replace('/[^a-z0-9_-]/i', '', (string) Arr::get($body, 'run', '')) ?: date('Ymd_His');

        if (!in_array($target, ['webp', 'jpg', 'jpeg'], true)) {
            return new JsonResponse(['error' => 'Geçersiz hedef format.'], 400);
        }

        $toWebp = $target === 'webp';
        $sourceMimes = $toWebp ? ['image/jpeg', 'image/jpg'] : ['image/webp'];
        $newMime = $toWebp ? 'image/webp' : 'image/jpeg';
        $newExt = $toWebp ? 'webp' : 'jpg';

        $total = FramioImage::whereIn('mime_type', $sourceMimes)->count();

        if (Arr::get($body, 'dry_run')) {
            return new JsonResponse([
                'total' => $total,
                'configured' => $this->cloud->isConfigured(),
                'credential' => $this->cloud->credentialSource(),
            ]);
        }

        if (!$this->cloud->isConfigured()) {
            return new JsonResponse(['error' => 'Firebase yapılandırması eksik (bucket adı veya kimlik dosyası).'], 422);
        }

        $images = FramioImage::whereIn('mime_type', $sourceMimes)
            ->where('id', '>', $afterId)
            ->orderBy('id')
            ->take($limit)
            ->get();

        if ($images->isEmpty()) {
            return new JsonResponse([
                'completed' => true, 'converted' => 0, 'failed' => [], 'remaining' => 0,
                'next_after_id' => $afterId, 'message' => 'Dönüştürülecek başka görsel kalmadı.',
            ]);
        }

        @set_time_limit(300);
        $bucket = $this->cloud->bucket();
        $manager = new ImageManager(extension_loaded('imagick') ? new ImagickDriver() : new GdDriver());

        $converted = 0;
        $postsUpdated = 0;
        $failed = [];

        foreach ($images as $img) {
            $afterId = $img->id;
            try {
                $postsUpdated += $this->convertImage($img, $bucket, $manager, $newExt, $newMime, $withOriginals, $keepOld, $run);
                $converted++;
            } catch (\Throwable $e) {
                $failed[] = ['id' => $img->id, 'file' => $img->filename, 'reason' => $e->getMessage()];
                resolve('log')->warning("[framio-upload-exif] Dönüştürme hatası #{$img->id}: " . $e->getMessage());
            }
        }

        $remainingAfter = FramioImage::whereIn('mime_type', $sourceMimes)->where('id', '>', $afterId)->count();

        return new JsonResponse([
            'completed' => $remainingAfter === 0,
            'converted' => $converted,
            'posts_updated' => $postsUpdated,
            'failed' => $failed,
            'remaining' => $remainingAfter,
            'next_after_id' => $afterId,
            'run' => $run,
            'message' => "{$converted} görsel " . strtoupper($newExt) . " formatına dönüştürüldü. Kalan: {$remainingAfter}",
        ]);
    }

    /** @return int güncellenen gönderi sayısı */
    protected function convertImage(FramioImage $img, Bucket $bucket, ImageManager $manager, string $newExt, string $newMime, bool $withOriginals, bool $keepOld, string $run): int
    {
        $mainName = $this->cloud->objectName($img->path);
        if (!$mainName || !$bucket->object($mainName)->exists()) {
            throw new \RuntimeException('Ana görsel bulutta bulunamadı: ' . $img->path);
        }

        $settings = resolve(SettingsRepositoryInterface::class);
        // Yeni yapı: dinamik boyutlandırma açıkken küçük boyutlar dosya değil, ?w= adresi olur
        $dynamic = $newExt === 'webp' && (bool) $settings->get('framio-upload-exif.cdn_dynamic_resize', false);
        $thumbWidth = (int) ($settings->get('framio-upload-exif.thumb_width', 1024) ?: 1024);
        $miniWidth = (int) ($settings->get('framio-upload-exif.mini_width', 250) ?: 250);

        $dir = str_contains($mainName, '/') ? substr($mainName, 0, strrpos($mainName, '/') + 1) : '';
        $base = basename($mainName);
        $stem = preg_replace('/\.(jpe?g|webp)$/i', '', $base);

        // Dönüştürülecek nesneler: eski ad → kalite
        $jobs = [$mainName => 88];
        // Küçük boyut dosyaları: [nesne adı => genişlik]; JPG ve önceki dönüşümlerden kalan WebP kopyaları dahil
        $sizeFiles = [];
        $thumbName = ($img->thumb_path && !str_contains($img->thumb_path, '?')) ? $this->cloud->objectName($img->thumb_path) : null;
        if ($thumbName) $sizeFiles[$thumbName] = $thumbWidth;
        foreach (['jpg', 'jpeg', 'webp'] as $ext) {
            $sizeFiles[$dir . 'thumb_' . $stem . '.' . $ext] ??= $thumbWidth;
            $sizeFiles[$dir . 'mini_' . $stem . '.' . $ext] ??= $miniWidth;
        }

        if (!$dynamic) {
            foreach ([$thumbName, $dir . 'thumb_' . $base, $dir . 'mini_' . $base] as $n) {
                if ($n) $jobs[$n] ??= 82;
            }
            $sizeFiles = [];
        }

        $origName = ($withOriginals && $img->original_path) ? $this->cloud->objectName($img->original_path) : null;
        if ($origName) $jobs[$origName] = 95;

        $renames = []; // eski ad → yeni ad (başarıyla yüklenenler)
        foreach ($jobs as $old => $quality) {
            $object = $bucket->object($old);
            if ($old !== $mainName && !$object->exists()) continue;

            // Bellekte işlenir; sunucuya geçici dosya yazılmaz
            $new = $this->swapExt($old, $newExt);
            $image = $manager->read($object->downloadAsString());
            $encoded = $newExt === 'webp' ? (string) $image->toWebp($quality) : (string) $image->toJpeg(min(95, $quality + 4));
            unset($image);

            $bucket->upload($encoded, [
                'name' => $new,
                'predefinedAcl' => 'publicRead',
                'resumable' => false,
                'metadata' => [
                    'contentType' => $newMime,
                    'cacheControl' => 'public, max-age=31536000',
                ],
            ]);
            unset($encoded);
            $renames[$old] = $new;
        }

        // Yeni yapıda artık gerekmeyen küçük boyut dosyaları (yalnızca silinir)
        $obsolete = [];
        foreach ($sizeFiles as $name => $w) {
            if ($name !== $mainName && !isset($renames[$name]) && $bucket->object($name)->exists()) $obsolete[$name] = $w;
        }

        // Görsel kaydı (önceki hali günlüğe)
        $before = $img->only(['path', 'thumb_path', 'original_path', 'filename', 'mime_type']);
        $img->path = $this->swapUrlExt($img->path, $newExt);
        $img->thumb_path = $dynamic
            ? preg_replace('/\?.*$/', '', $img->path) . '?w=' . $thumbWidth
            : ($img->thumb_path ? $this->swapUrlExt($img->thumb_path, $newExt) : null);
        if ($origName && isset($renames[$origName])) $img->original_path = $this->swapUrlExt($img->original_path, $newExt);
        $img->filename = $this->swapExt($img->filename, $newExt);
        $img->mime_type = $newMime;

        // Gönderilerdeki adresler: dosya adı benzersiz (zaman damgalı); ham ve kodlanmış biçimler değiştirilir.
        // inverse: geri almada kullanılır; aynı yeni adrese birden çok eski ad düşerse görsel kaydının kullandığı ad tercih edilir.
        $forward = [];
        $inverse = [];
        $oldThumb = $before['thumb_path'] ? rawurldecode(preg_replace('/\?.*$/', '', $before['thumb_path'])) : '';
        $add = function (string $ob, string $nb, string $query = '') use (&$forward, &$inverse, $oldThumb) {
            $preferred = $oldThumb !== '' && str_ends_with($oldThumb, '/' . $ob);
            foreach (UrlVariants::map($ob, $nb, $query) as $o => $target) {
                $forward[$o] = $target;
                if (!isset($inverse[$target]) || $preferred) $inverse[$target] = $o;
            }
        };
        $newMainBase = basename($this->swapExt($mainName, $newExt));
        foreach ($renames as $old => $new) {
            $add(basename($old), basename($new));
        }
        foreach ($obsolete as $name => $w) {
            $add(basename($name), $newMainBase, '?w=' . $w);
        }
        $replace = $forward;

        $postsUpdated = 0;
        $postIds = [];
        $oldObjects = array_merge(array_keys($renames), array_keys($obsolete));
        $img->getConnection()->transaction(function () use ($img, $replace, $inverse, &$postsUpdated, &$postIds, $before, $renames, $oldObjects, $keepOld, $run) {
            $img->save();
            if ($replace) {
                $query = Post::query()->where(function ($q) use ($replace) {
                    foreach (array_keys($replace) as $needle) {
                        $q->orWhere('content', 'like', '%' . addcslashes($needle, '%_\\') . '%');
                    }
                });
                foreach ($query->cursor() as $post) {
                    $raw = $post->getRawOriginal('content');
                    $new = strtr($raw, $replace);
                    if ($new !== $raw) {
                        Post::query()->whereKey($post->id)->update(['content' => $new]);
                        $postIds[] = $post->id;
                        $postsUpdated++;
                    }
                }
            }

            $img->getConnection()->table('framio_media_conversions')->insert([
                'run' => $run,
                'image_id' => $img->id,
                'before' => json_encode($before, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'replacements' => json_encode(['forward' => $replace, 'inverse' => $inverse], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'post_ids' => json_encode($postIds),
                'new_objects' => json_encode(array_values($renames), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'old_objects' => json_encode($oldObjects, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'old_deleted' => !$keepOld,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        });

        // Eşlemenin yakalayamadığı yazılışlar için (karışık kodlamalar) gönderileri bir kez daha onar
        $repair = resolve(PostImageUrlRepair::class);
        $postsUpdated += count($repair->repair($img));
        $safeToDelete = !$repair->hasStaleReferences($img);

        // Ancak kayıtlar güncellendikten sonra eski dosyaları sil (koruma açıksa ya da hâlâ başvuru varsa dokunulmaz)
        if (!$keepOld && $safeToDelete) foreach ($oldObjects as $old) {
            try {
                $bucket->object($old)->delete();
            } catch (\Throwable $e) {
                // eski dosya kalırsa yalnızca yer kaplar, site etkilenmez
            }
        }

        return $postsUpdated;
    }

    protected function swapExt(string $name, string $ext): string
    {
        return preg_replace('/\.(jpe?g|webp)$/i', '.' . $ext, $name);
    }

    protected function swapUrlExt(string $url, string $ext): string
    {
        return preg_replace('/\.(jpe?g|webp)(\?.*)?$/i', '.' . $ext . '$2', $url);
    }
}
