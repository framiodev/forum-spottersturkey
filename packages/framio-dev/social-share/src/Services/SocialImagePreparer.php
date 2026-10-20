<?php

namespace Framio\SocialShare\Services;

use Illuminate\Database\ConnectionInterface;
use Intervention\Image\ImageManager;
use Throwable;

/**
 * Sosyal medyaya gidecek görseller: mesajdaki küçük görsel (…?w=1024) yerine
 *  1) yüklemede seçilen imza kayıtlıysa: imzasız ORİJİNAL indirilir, o imza üzerine basılır,
 *  2) kayıt yoksa: sunucudaki imzalı tam boy görsel kullanılır,
 * en çok 4096 px, JPEG (Instagram JPEG ister, 8 MB sınırı) olarak geçici klasöre yazılır.
 * Dosya adı silinme zamanını taşır (del{unix}_…); paylaşımdan 1 saat sonra clean() siler.
 */
class SocialImagePreparer
{
    public const DIR = 'assets/social-temp';

    public function __construct(protected ConnectionInterface $db)
    {
    }

    /** @return array<string,string> eski adres → hazırlanan adres (hazırlanamayan eski haliyle kalır) */
    public function prepareMap(array $urls, int $deleteAfter): array
    {
        @ini_set('memory_limit', '768M');
        @set_time_limit(300);
        $map = [];
        foreach (array_unique(array_filter($urls, 'is_string')) as $url) {
            try {
                $map[$url] = $this->prepare($url, $deleteAfter) ?: $url;
            } catch (Throwable $e) {
                $map[$url] = $url;
            }
        }

        return $map;
    }

    public function prepare(string $url, int $deleteAfter): ?string
    {
        $dir = public_path(self::DIR);
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) return null;

        $base = preg_replace('/\?.*$/', '', $url);
        $rec = $this->record($url, $base);
        $driver = extension_loaded('imagick') ? new \Intervention\Image\Drivers\Imagick\Driver() : new \Intervention\Image\Drivers\Gd\Driver();
        $manager = new ImageManager($driver);

        $watermark = $rec ? $this->watermarkPath($rec) : null;
        if ($rec && $watermark && !empty($rec->original_path)) {
            // İmzasız orijinal + kayıtlı imza
            $img = $manager->read($this->fetch($rec->original_path));
            $img->scaleDown(width: 4096, height: 4096);
            $wm = $manager->read($watermark);
            $wm->scaleDown(width: $img->width());
            $img->place($wm, 'bottom');
            unset($wm);
        } else {
            // İmzalı tam boy (kayıt yoksa adresin boyut parametresiz hali)
            $img = $manager->read($this->fetch($rec && !empty($rec->path) ? preg_replace('/\?.*$/', '', $rec->path) : $base));
            $img->scaleDown(width: 4096, height: 4096);
        }

        // Instagram 8 MB üstünü kabul etmez: gerekirse kalite düşürülür
        $bytes = '';
        foreach ([92, 88, 84, 80] as $q) {
            $bytes = (string) $img->toJpeg($q);
            if (strlen($bytes) < 7.5 * 1024 * 1024) break;
        }
        unset($img);

        $name = 'del' . $deleteAfter . '_' . substr(sha1($url . microtime()), 0, 16) . '.jpg';
        file_put_contents($dir . '/' . $name, $bytes);

        return rtrim(app()->url(), '/') . '/' . self::DIR . '/' . $name;
    }

    /** Silinme zamanı geçmiş hazırlanmış görseller */
    public function clean(): int
    {
        $n = 0;
        foreach (glob(public_path(self::DIR) . '/del*_*.jpg') ?: [] as $f) {
            if (preg_match('/\/del(\d+)_/', $f, $m) && (int) $m[1] < time()) {
                @unlink($f) && $n++;
            }
        }

        return $n;
    }

    protected function record(string $url, string $base): ?object
    {
        $t = $this->db->getSchemaBuilder()->hasTable('framio_media_images') ? 'framio_media_images' : null;
        if (!$t) return null;

        return $this->db->table($t)
            ->where('thumb_path', $url)->orWhere('path', $base)->orWhere('path', $url)->orWhere('original_path', $base)
            ->orWhere('thumb_path', 'like', $base . '%')
            ->orderByDesc('id')->first();
    }

    /** Yüklemede seçilen imzanın dosyası (sahibinin, genel ya da kök klasör) */
    protected function watermarkPath(object $rec): ?string
    {
        $file = $rec->watermark ?? null;
        if (!$file || $file === 'none') return null;
        $base = public_path('assets/watermarks');
        foreach (array_filter([$rec->watermark_owner ?? null, 'global', null]) as $owner) {
            $p = $base . '/' . $owner . '/' . $file;
            if (is_file($p)) return $p;
        }

        return is_file($base . '/' . $file) ? $base . '/' . $file : null;
    }

    protected function fetch(string $url): string
    {
        if (str_starts_with($url, '/')) $url = rtrim(app()->url(), '/') . $url;
        $ctx = stream_context_create(['http' => ['timeout' => 60, 'follow_location' => 1], 'ssl' => ['verify_peer' => true]]);
        $bytes = @file_get_contents($url, false, $ctx);
        if ($bytes === false || $bytes === '') throw new \RuntimeException('Görsel indirilemedi: ' . $url);

        return $bytes;
    }
}
