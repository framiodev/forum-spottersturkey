<?php

namespace Framio\NetworkCrosspost\Services;

use Google\Cloud\Storage\StorageClient;
use Illuminate\Support\Arr;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Drivers\Imagick\Driver as ImagickDriver;
use Intervention\Image\ImageManager;

class WatermarkProcessor
{
    /**
     * Hedef forumun Firebase ve Watermark yapılandırmasını tespit et
     */
    public function detectPlatformConfig(): ?array
    {
        // 0. Upload & EXIF eklentisinin admin panelinden ayarlanan bulut depolaması (asıl kaynak)
        if (class_exists(\Framio\UploadExif\Storage\CloudStorage::class)) {
            try {
                $cloud = resolve(\Framio\UploadExif\Storage\CloudStorage::class);
                if ($cloud->isConfigured()) {
                    return [
                        'platform' => 'upload-exif',
                        'storage' => $cloud,
                        'bucket' => $cloud->bucketName(),
                        'domain' => $cloud->baseUrl(),
                        'folder' => $cloud->folder() . '/',
                        'key_path' => null,
                        'default_wm_placement' => 'bottom',
                    ];
                }
            } catch (\Throwable $e) {
            }
        }

        // 1. Spotters Turkey Tespiti
        $spottersKey = storage_path('firebase-auth.json');
        if (file_exists($spottersKey) && (class_exists(\SpottersTurkey\UploadExif\Database\SpotterImage::class) || is_dir(public_path('assets/spotters')))) {
            return [
                'platform' => 'spotters',
                'bucket' => 'spotters-turkey-storage.firebasestorage.app',
                'domain' => 'https://img.spottersturkey.com',
                'folder' => 'assets/spotters/',
                'key_path' => $spottersKey,
                'default_wm_placement' => 'center',
            ];
        }

        // 2. Ulaşım Arşiv Tespiti
        $arsivKey = base_path('firebase-key.json');
        if (file_exists($arsivKey) && (class_exists(\UlasimArsiv\UploadExif\Database\SpotterImage::class) || is_dir(public_path('assets/ulasimarsiv')))) {
            return [
                'platform' => 'ulasimarsiv',
                'bucket' => 'ulasim-arsiv-forum-storage.firebasestorage.app',
                'domain' => 'https://images.ulasimarsiv.com',
                'folder' => 'assets/ulasimarsiv/',
                'key_path' => $arsivKey,
                'default_wm_placement' => 'bottom',
            ];
        }

        // Genel yedek arama
        if (file_exists($arsivKey)) {
            return [
                'platform' => 'custom',
                'bucket' => 'ulasim-arsiv-forum-storage.firebasestorage.app',
                'domain' => 'https://images.ulasimarsiv.com',
                'folder' => 'assets/crosspost/',
                'key_path' => $arsivKey,
                'default_wm_placement' => 'bottom',
            ];
        }

        if (file_exists($spottersKey)) {
            return [
                'platform' => 'custom',
                'bucket' => 'spotters-turkey-storage.firebasestorage.app',
                'domain' => 'https://img.spottersturkey.com',
                'folder' => 'assets/spotters/',
                'key_path' => $spottersKey,
                'default_wm_placement' => 'center',
            ];
        }

        return null;
    }

    /**
     * Tek bir görseli seçilen imza moduna göre işle ve Firebase'e yükle
     *
     * @param array $attachment
     * @param array $watermarkConfig ['mode' => '...', 'id' => '...', 'custom' => '...']
     * @return array|null İşlenmiş yeni URL'ler veya başarısız/keep_source durumunda null
     */
    public function processAttachment(array $attachment, array $watermarkConfig): ?array
    {
        $mode = Arr::get($watermarkConfig, 'mode', 'keep_source');
        if ($mode === 'keep_source') {
            return null; // Kaynak sitedeki mevcut URL'ler korunacak
        }

        $platformConfig = $this->detectPlatformConfig();
        if (!$platformConfig) {
            $this->log('Bu sitede bulut depolama yapılandırması bulunamadı');
            return null; // Firebase veya imza altyapısı bu sitede kurulu değilse geri dön
        }

        // İndirilecek görsel URL'si: tercihen imzasız orijinal_path, yoksa normal path
        $originalUrl = Arr::get($attachment, 'original_path');
        $mainUrl = Arr::get($attachment, 'path');

        if (empty($originalUrl) && empty($mainUrl)) {
            return null;
        }

        // 1. Orijinal Görseli Geçici Dosyaya İndir (Önce orijinal yedek, başarısızsa ana görsel)
        $tempOriginal = tempnam(sys_get_temp_dir(), 'crosspost_orig_');
        $downloaded = false;

        if (!empty($originalUrl)) {
            $downloaded = $this->downloadFile($originalUrl, $tempOriginal);
        }

        // Eğer orijinal_path bulunamazsa (404 Not Found vb.) veya boşsa ana görseli indir
        if ((!$downloaded || filesize($tempOriginal) === 0) && !empty($mainUrl) && $mainUrl !== $originalUrl) {
            $downloaded = $this->downloadFile($mainUrl, $tempOriginal);
        }

        if (!$downloaded || filesize($tempOriginal) === 0) {
            @unlink($tempOriginal);
            $this->log('Görsel indirilemedi: ' . ($originalUrl ?: $mainUrl));
            return null;
        }

        $tempWatermarked = tempnam(sys_get_temp_dir(), 'crosspost_wm_') . '.jpg';
        $tempThumb = tempnam(sys_get_temp_dir(), 'crosspost_th_') . '.webp';
        $tempCustomWm = null;

        try {
            // 2. Intervention Image v3 ile Yükle
            $driver = extension_loaded('imagick') ? new ImagickDriver() : new GdDriver();
            $manager = new ImageManager($driver);
            $img = $manager->read($tempOriginal);

            // 3. Mod'a Göre İmza Uygula
            if ($mode === 'target_site') {
                $wmId = Arr::get($watermarkConfig, 'id');
                $targetUsername = Arr::get($watermarkConfig, 'username');
                $wmPath = $this->resolveWatermarkPath($wmId, $targetUsername);

                if (!$wmPath || !file_exists($wmPath)) {
                    $this->log('İmza dosyası bulunamadı: ' . ($wmId ?: '-') . ' / ' . ($targetUsername ?: '-'));
                }

                if ($wmPath && file_exists($wmPath)) {
                    $wm = $manager->read($wmPath);
                    $targetWidth = $img->width();
                    $targetHeight = $img->height();
                    $wmWidth = $wm->width();
                    $wmHeight = $wm->height();

                    // Eğer filigran tam tuval (Spotters Turkey gibi 3:2 tuval) ise en-boy koruyarak kırpıp ortala
                    if ($wmWidth > 0 && ($wmHeight / $wmWidth) > 0.3) {
                        $targetRatio = $targetWidth / $targetHeight;
                        $wmRatio = $wmWidth / $wmHeight;

                        if ($targetRatio > $wmRatio) {
                            $wm->scale(width: $targetWidth);
                        } else {
                            $wm->scale(height: $targetHeight);
                        }

                        $cropX = intval(max(0, ($wm->width() - $targetWidth) / 2));
                        $cropY = intval(max(0, $wm->height() - $targetHeight));
                        $wm->crop($targetWidth, $targetHeight, $cropX, $cropY);
                        $img->place($wm, 'center');
                    } else {
                        // Alt şerit filigran (Ulaşım Arşiv gibi)
                        $wm->scaleDown(width: $targetWidth);
                        $placement = str_contains(strtolower($wmPath), 'orta') ? 'center' : $platformConfig['default_wm_placement'];
                        $img->place($wm, $placement);
                    }

                    unset($wm);
                }
            } elseif ($mode === 'custom') {
                $customBase64 = Arr::get($watermarkConfig, 'custom');
                if (!empty($customBase64) && preg_match('/^data:image\/(\w+);base64,/', $customBase64)) {
                    $base64Clean = substr($customBase64, strpos($customBase64, ',') + 1);
                    $decodedData = base64_decode($base64Clean);
                    if ($decodedData) {
                        $tempCustomWm = tempnam(sys_get_temp_dir(), 'crosspost_cwm_') . '.png';
                        file_put_contents($tempCustomWm, $decodedData);

                        $wm = $manager->read($tempCustomWm);
                        $wm->scaleDown(width: $img->width());
                        $img->place($wm, 'bottom');
                        unset($wm);
                    }
                }
            }
            // mode === 'no_watermark' durumunda imza basılmaz, doğrudan temiz görsel işlenir

            // 4. Ana Görseli Kaydet ve EXIF Bilgisini Aktar
            $img->save($tempWatermarked, quality: 90);
            $this->transferExifData($tempOriginal, $tempWatermarked);

            // 5. Küçük Resim (Thumb) Oluştur
            $imgThumb = clone $img;
            $imgThumb->scaleDown(width: 1024);
            $imgThumb->save($tempThumb, quality: 80);
            unset($imgThumb);
            unset($img);

            // 6. Firebase Cloud Storage'a Yükle
            $bucket = isset($platformConfig['storage'])
                ? $platformConfig['storage']->bucket()
                : (new StorageClient(['keyFilePath' => $platformConfig['key_path']]))->bucket($platformConfig['bucket']);

            $subDir = date('Y/m');
            $cloudFolder = $platformConfig['folder'] . $subDir . '/';

            $rawFilename = Arr::get($attachment, 'filename', 'image.jpg');
            $pathInfo = pathinfo($rawFilename);
            $cleanBaseName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $pathInfo['filename'] ?? 'photo');
            $ts = time() . '_' . rand(1000, 9999);

            $safeMainName = $ts . '_' . $cleanBaseName . '.jpg';
            $safeThumbName = 'thumb_' . $ts . '_' . $cleanBaseName . '.webp';

            // Ana görsel yükleme
            $bucket->upload(fopen($tempWatermarked, 'r'), [
                'name' => $cloudFolder . $safeMainName,
                'predefinedAcl' => 'publicRead',
                'metadata' => [
                    'contentType' => 'image/jpeg',
                    'contentDisposition' => 'inline; filename="' . $rawFilename . '"',
                ],
            ]);

            // Küçük resim yükleme
            $bucket->upload(fopen($tempThumb, 'r'), [
                'name' => $cloudFolder . $safeThumbName,
                'predefinedAcl' => 'publicRead',
                'metadata' => [
                    'contentType' => 'image/webp',
                    'contentDisposition' => 'inline; filename="thumb_' . $rawFilename . '"',
                ],
            ]);

            $finalMainUrl = $platformConfig['domain'] . '/' . $cloudFolder . rawurlencode($safeMainName);
            $finalThumbUrl = $platformConfig['domain'] . '/' . $cloudFolder . rawurlencode($safeThumbName);

            // Temizlik
            @unlink($tempOriginal);
            @unlink($tempWatermarked);
            @unlink($tempThumb);
            if ($tempCustomWm) @unlink($tempCustomWm);

            return [
                'path' => $finalMainUrl,
                'thumb_path' => $finalThumbUrl,
                'original_path' => Arr::get($attachment, 'original_path', $finalMainUrl),
            ];
        } catch (\Throwable $e) {
            $this->log('İmza işlenemedi: ' . $e->getMessage());
            // Hata oluşursa temizle ve null dön (orijinal yollar kullanılır)
            @unlink($tempOriginal);
            @unlink($tempWatermarked);
            @unlink($tempThumb);
            if ($tempCustomWm) @unlink($tempCustomWm);

            return null;
        }
    }

    /**
     * İstenen filigran dosyasının yerel tam yolunu bul
     */
    protected function resolveWatermarkPath(?string $wmId, ?string $username = null): ?string
    {
        $baseDir = public_path('assets/watermarks');
        if (!is_dir($baseDir)) {
            return null;
        }

        if (!empty($wmId)) {
            $directPath = $baseDir . '/' . ltrim($wmId, '/');
            if (file_exists($directPath)) {
                return $directPath;
            }
            if (file_exists($directPath . '.png')) {
                return $directPath . '.png';
            }
        }

        // Eğer kullanıcı adı verilmişse onun klasörünü ara (Ulaşım Arşiv tarzı)
        if (!empty($username)) {
            $cleanUser = preg_replace('/[^a-zA-Z0-9_-]/', '', $username);
            $userDir = $baseDir . '/' . $cleanUser;
            if (is_dir($userDir)) {
                $userFiles = glob($userDir . '/*.png');
                if (!empty($userFiles)) {
                    return $userFiles[0];
                }
            }
        }

        // Varsayılan ulasimarsiv klasöründe ara
        if (is_dir($baseDir . '/ulasimarsiv')) {
            $arsivFiles = glob($baseDir . '/ulasimarsiv/*.png');
            if (!empty($arsivFiles)) {
                return $arsivFiles[0];
            }
        }

        // Eğer belirli bir imza bulunamadıysa ilk geçerli PNG dosyasını bul (Spotters Turkey tarzı)
        $files = glob($baseDir . '/*.png');
        if (!empty($files)) {
            return $files[0];
        }

        // Alt klasörlerde ara
        $subFiles = glob($baseDir . '/*/*.png');
        if (!empty($subFiles)) {
            return $subFiles[0];
        }

        return null;
    }

    protected function log(string $message): void
    {
        try {
            resolve('log')->warning('[crosspost] ' . $message);
        } catch (\Throwable $e) {
        }
    }

    /**
     * Uzak URL'den dosyayı cURL ile indir
     */
    protected function downloadFile(string $url, string $destinationPath): bool
    {
        $fp = @fopen($destinationPath, 'wb');
        if (!$fp) return false;

        // URL yolundaki boşlukları ve özel karakterleri düzgünce rawurlencode yap
        $parts = parse_url($url);
        if (isset($parts['path'])) {
            $pathSegments = explode('/', $parts['path']);
            $encodedSegments = array_map(function ($segment) {
                return rawurlencode(rawurldecode($segment));
            }, $pathSegments);
            $parts['path'] = implode('/', $encodedSegments);

            $url = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '') .
                (isset($parts['port']) ? ':' . $parts['port'] : '') .
                $parts['path'] .
                (isset($parts['query']) ? '?' . $parts['query'] : '');
        }

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_FILE, $fp);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 180);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_USERAGENT, 'FramioCrosspost/1.0');

        $success = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if (!$success || $httpCode < 200 || $httpCode >= 300) {
            $this->log('İndirme başarısız (' . $httpCode . ' ' . curl_error($ch) . '): ' . $url);
        }
        curl_close($ch);
        fclose($fp);

        return $success && $httpCode >= 200 && $httpCode < 300;
    }

    /**
     * Orijinal JPEG'deki EXIF bayt bloğunu (\xFF\xE1) yeni JPEG'e aktar
     */
    protected function transferExifData(string $sourceFile, string $destinationFile): void
    {
        $sourceContent = @file_get_contents($sourceFile);
        $destContent = @file_get_contents($destinationFile);
        if (!$sourceContent || !$destContent) return;

        $pos = 2;
        $exifBlock = '';
        $srcLen = strlen($sourceContent);

        while ($pos < $srcLen - 4) {
            $marker = substr($sourceContent, $pos, 2);
            if ($marker === "\xFF\xE1") {
                $length = unpack('n', substr($sourceContent, $pos + 2, 2))[1];
                $exifBlock = substr($sourceContent, $pos, $length + 2);
                break;
            }
            if ($marker === "\xFF\xDA" || $marker === "\xFF\xD9") {
                break;
            }
            $len = unpack('n', substr($sourceContent, $pos + 2, 2))[1];
            $pos += $len + 2;
        }

        if (!empty($exifBlock)) {
            $newDestContent = substr($destContent, 0, 2) . $exifBlock . substr($destContent, 2);
            @file_put_contents($destinationFile, $newDestContent);
        }
    }
}
