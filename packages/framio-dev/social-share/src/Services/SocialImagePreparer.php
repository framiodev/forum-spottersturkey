<?php

namespace Framio\SocialShare\Services;

use Carbon\Carbon;
use Illuminate\Database\ConnectionInterface;
use Intervention\Image\ImageManager;
use Throwable;

/**
 * Sosyal medya görselleri (tam kalite):
 *  - Görsel SEÇİLDİĞİNDE: sunucudaki imzasız ORİJİNAL indirilir, kullanıcının o fotoğrafa yüklemede eklediği
 *    imza (framio_media_images.watermark / watermark_owner) kayıttan alınıp basılır, orijinal boyutta JPEG
 *    olarak Firebase'e geçici yüklenir. Kayıt: framio_social_prepared (durum: selected → queued → published).
 *  - Paylaşım yapılınca (anlık ya da planlanan saatte): 15 dakika sonra Firebase'den silinir.
 *  - Seçilip hiç paylaşılmayan / planlanmayanlar 24 saat sonra silinir. Planlananlar paylaşılana kadar korunur.
 */
class SocialImagePreparer
{
    public const TABLE = 'framio_social_prepared';
    public const DELETE_AFTER_PUBLISH = 15 * 60;

    public function __construct(protected ConnectionInterface $db)
    {
    }

    protected function ready(): bool
    {
        return $this->db->getSchemaBuilder()->hasTable(self::TABLE);
    }

    /** @return array<string,string> kaynak adres → hazırlanmış adres (hazırlanamayan aynen kalır) */
    public function prepareMap(array $urls): array
    {
        @ini_set('memory_limit', '1024M');
        @set_time_limit(600);
        $map = [];
        foreach (array_unique(array_filter($urls, 'is_string')) as $url) {
            if ($this->isPrepared($url)) {
                $map[$url] = $url;
                continue;
            }
            // Aynı görsel daha önce hazırlandıysa (silinmemişse) yeniden işlenmez
            $hit = $this->ready() ? $this->db->table(self::TABLE)->where('source_url', $url)->whereIn('status', ['selected', 'queued'])->orderByDesc('id')->first() : null;
            if ($hit) {
                $map[$url] = $hit->url;
                continue;
            }
            try {
                $map[$url] = $this->prepare($url) ?: $url;
            } catch (Throwable $e) {
                resolve('log')->warning('[social-share] Görsel hazırlanamadı: ' . $e->getMessage());
                $map[$url] = $url;
            }
        }

        return $map;
    }

    public function isPrepared(string $url): bool
    {
        return $this->ready() && $this->db->table(self::TABLE)->where('url', $url)->exists();
    }

    protected function prepare(string $url): ?string
    {
        $base = preg_replace('/\?.*$/', '', $url);
        $rec = $this->record($url, $base);
        $manager = new ImageManager(extension_loaded('imagick') ? new \Intervention\Image\Drivers\Imagick\Driver() : new \Intervention\Image\Drivers\Gd\Driver());

        $watermark = $rec ? $this->watermarkPath($rec) : null;
        if ($rec && $watermark && !empty($rec->original_path)) {
            // İmzasız orijinal (tam boyut) + o fotoğrafa eklenmiş imza
            $img = $manager->read($this->fetch($rec->original_path));
            $wm = $manager->read($watermark);
            $wm->scaleDown(width: $img->width());
            $img->place($wm, 'bottom');
            unset($wm);
        } else {
            // İmza kaydı olmayan eski fotoğraf: sunucudaki imzalı tam boy
            $img = $manager->read($this->fetch($rec && !empty($rec->path) ? preg_replace('/\?.*$/', '', $rec->path) : $base));
        }

        // Orijinal boyut korunur; yalnızca Instagram'ın 8 MB sınırı aşılırsa önce kalite, sonra boyut küçülür
        $bytes = '';
        for ($i = 0; $i < 6; $i++) {
            foreach ([92, 88, 84] as $q) {
                $bytes = (string) $img->toJpeg($q);
                if (strlen($bytes) < 7.5 * 1024 * 1024) break 2;
            }
            $img->scaleDown(width: (int) ($img->width() * 0.85));
        }
        unset($img);

        $name = 'social_' . date('Ymd_His') . '_' . substr(sha1($url . microtime()), 0, 12) . '.jpg';
        [$publicUrl, $object] = $this->store($bytes, $name);
        if ($this->ready()) {
            $this->db->table(self::TABLE)->insert([
                'source_url' => mb_substr($url, 0, 1000), 'url' => $publicUrl, 'object' => $object,
                'status' => 'selected', 'created_at' => Carbon::now(),
            ]);
        }

        return $publicUrl;
    }

    /** Firebase'e (yükleme eklentisinin bulut ayarlarıyla); bulut yoksa sitenin geçici klasörüne */
    protected function store(string $bytes, string $name): array
    {
        try {
            $cloud = resolve(\Framio\UploadExif\Storage\CloudStorage::class);
            if ($cloud->isConfigured()) {
                $object = $cloud->folder() . '/social-temp/' . $name;
                $cloud->bucket()->upload($bytes, [
                    'name' => $object,
                    'predefinedAcl' => 'publicRead',
                    'resumable' => false,
                    'metadata' => ['contentType' => 'image/jpeg', 'cacheControl' => 'no-store'],
                ]);

                return [$cloud->baseUrl() . '/' . $cloud->folder() . '/social-temp/' . rawurlencode($name), $object];
            }
        } catch (Throwable $e) {
            resolve('log')->warning('[social-share] Firebase yüklemesi olmadı, yerel geçici klasör: ' . $e->getMessage());
        }
        $dir = public_path('assets/social-temp');
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        file_put_contents($dir . '/' . $name, $bytes);

        return [rtrim(app()->url(), '/') . '/assets/social-temp/' . $name, 'local:' . $name];
    }

    /** Planlandı: paylaşım saatine kadar silinmez */
    public function markQueued(array $urls): void
    {
        if ($this->ready() && $urls) $this->db->table(self::TABLE)->whereIn('url', $urls)->update(['status' => 'queued']);
    }

    /** Paylaşıldı: 15 dakika sonra silinir */
    public function markPublished(array $urls): void
    {
        if ($this->ready() && $urls) {
            $this->db->table(self::TABLE)->whereIn('url', $urls)->update(['status' => 'published', 'delete_after' => Carbon::now()->addSeconds(self::DELETE_AFTER_PUBLISH)]);
        }
    }

    /** Süresi dolanları Firebase'den (ya da yerelden) siler */
    public function clean(): int
    {
        if (!$this->ready()) return 0;
        $now = Carbon::now();
        $rows = $this->db->table(self::TABLE)
            ->where(fn ($q) => $q->where('status', 'published')->where('delete_after', '<=', $now))
            ->orWhere(fn ($q) => $q->where('status', 'selected')->where('created_at', '<=', $now->copy()->subDay()))
            ->limit(100)->get();
        $n = 0;
        foreach ($rows as $r) {
            try {
                if (str_starts_with((string) $r->object, 'local:')) {
                    @unlink(public_path('assets/social-temp/' . substr($r->object, 6)));
                } else {
                    $obj = resolve(\Framio\UploadExif\Storage\CloudStorage::class)->bucket()->object($r->object);
                    if ($obj->exists()) $obj->delete();
                }
                $this->db->table(self::TABLE)->where('id', $r->id)->delete();
                $n++;
            } catch (Throwable $e) {
                resolve('log')->warning('[social-share] Geçici görsel silinemedi: ' . $e->getMessage());
            }
        }

        return $n;
    }

    protected function record(string $url, string $base): ?object
    {
        if (!$this->db->getSchemaBuilder()->hasTable('framio_media_images')) return null;

        return $this->db->table('framio_media_images')
            ->where('thumb_path', $url)->orWhere('path', $base)->orWhere('path', $url)->orWhere('original_path', $base)
            ->orWhere('thumb_path', 'like', $base . '%')
            ->orderByDesc('id')->first();
    }

    /** Fotoğrafa yüklemede eklenen imzanın dosyası (sahibinin, genel ya da kök klasör) */
    protected function watermarkPath(object $rec): ?string
    {
        $file = $rec->watermark ?? null;
        if (!$file || $file === 'none') return null;
        $base = public_path('assets/watermarks');
        foreach (array_filter([$rec->watermark_owner ?? null, 'global']) as $owner) {
            if (is_file($base . '/' . $owner . '/' . $file)) return $base . '/' . $owner . '/' . $file;
        }

        return is_file($base . '/' . $file) ? $base . '/' . $file : null;
    }

    protected function fetch(string $url): string
    {
        if (str_starts_with($url, '/')) $url = rtrim(app()->url(), '/') . $url;
        $bytes = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 90, 'follow_location' => 1]]));
        if ($bytes === false || $bytes === '') throw new \RuntimeException('Görsel indirilemedi: ' . $url);

        return $bytes;
    }
}
