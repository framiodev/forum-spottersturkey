<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\User\User;
use Flarum\Settings\SettingsRepositoryInterface;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Drivers\Imagick\Driver as ImagickDriver;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\UploadExif\Database\FramioImage;
use Framio\UploadExif\Storage\CloudStorage;
use Framio\UploadExif\Image\ImageMeta;
use Illuminate\Support\Str;
use Throwable;

class UploadImageController implements RequestHandlerInterface
{
    protected $uploadPath;
    protected $settings;

    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        try {
            $actor = RequestUtil::getActor($request);
            $actor->assertRegistered();

            // 1. AYARLAR & FORMAT YAPILANDIRMASI
            $targetFormat = strtolower($this->settings->get('framio-upload-exif.image_format', 'webp')); // 'webp' veya 'jpg'
            $maxWidth     = (int) ($this->settings->get('framio-upload-exif.resize_width', 3840) ?: 3840);
            $quality      = (int) ($this->settings->get('framio-upload-exif.compression_quality', 88) ?: 88);

            // Thumbnail & Mini Genişlikleri
            $thumbWidth   = (int) ($this->settings->get('framio-upload-exif.thumb_width', 1024) ?: 1024);
            $miniWidth    = (int) ($this->settings->get('framio-upload-exif.mini_width', 250) ?: 250);

            // Dinamik CDN Image Resizing Modu (Seçenek B)
            $cdnDynamicResize = (bool) $this->settings->get('framio-upload-exif.cdn_dynamic_resize', false);

            // Orijinal (İmzasız Yedek) Ayarları
            $origResize  = $this->settings->get('framio-upload-exif.original_resize_width');
            $origQuality = (int) ($this->settings->get('framio-upload-exif.original_compression_quality', 95) ?: 95);

            @ini_set('memory_limit', '512M');
            @ini_set('max_execution_time', 300);

            $files = $request->getUploadedFiles();
            $file = $files['image'] ?? ($files['spotter_image'] ?? null);
            $body = $request->getParsedBody();

            $watermarkFilename = $body['watermark_type'] ?? 'none';
            $targetUsername    = $body['target_username'] ?? null;
            $customFilename    = $body['custom_filename'] ?? null;
            $customMusic       = $body['custom_music'] ?? null;
            $customGps         = $body['custom_gps'] ?? null;

            // Üye adına yükleme yalnızca yöneticiler için; bulunamayan üyede sessizce yöneticiye yazılmaz
            if (!$actor->isAdmin()) {
                $targetUsername = null;
            } elseif (!empty($targetUsername) && !User::where('username', trim($targetUsername))->exists()) {
                return new JsonResponse(['error' => 'Seçilen üye bulunamadı: ' . trim($targetUsername)], 422);
            }

            if (!$file || $file->getError() !== UPLOAD_ERR_OK) {
                return new JsonResponse(['error' => 'Dosya yüklenemedi veya izin verilen boyut aşıldı.'], 400);
            }

            // 2. DOSYA ADI & TEMİZLEME
            $clientFilename = $file->getClientFilename();
            $baseName = !empty($customFilename) ? trim($customFilename) : pathinfo($clientFilename, PATHINFO_FILENAME);
            $displayAltText = $baseName;

            // Türkçe karakterleri ve istenmeyen sembolleri temizle
            $asciiName = Str::ascii($baseName);
            $cleanName = preg_replace('/[^A-Za-z0-9\s\.\-_]/', '', $asciiName);
            $cleanNameWithSpaces = trim(preg_replace('/\s+/', ' ', str_replace(['-', '_'], ' ', $cleanName)));
            if (empty($cleanNameWithSpaces)) {
                $cleanNameWithSpaces = 'media_' . time();
            }

            $urlSafeSlug = Str::slug($cleanNameWithSpaces, '-');
            // Ana görsel WebP; yalnızca admin panelinden açıkça JPG seçilirse JPG üretilir
            $extension = ($targetFormat === 'jpg' || $targetFormat === 'jpeg') ? 'jpg' : 'webp';
            $mimeType = ($extension === 'webp') ? 'image/webp' : 'image/jpeg';

            $uniquePrefix = time() . '_' . Str::random(4);
            $safeName = $uniquePrefix . '_' . $urlSafeSlug . '.' . $extension;
            // Filigransız orijinal her zaman JPG (EXIF'in eksiksiz taşınabildiği biçim)
            $origSafeName = $uniquePrefix . '_' . $urlSafeSlug . '_orijinal.jpg';
            $thumbSafeName = 'thumb_' . $uniquePrefix . '_' . $urlSafeSlug . '.' . $extension;
            $miniSafeName = 'mini_' . $uniquePrefix . '_' . $urlSafeSlug . '.' . $extension;

            // Dosya bellekte işlenir; sunucuya hiçbir görsel dosyası yazılmaz
            $sourceBytes = (string) $file->getStream();
            $isJpegSource = substr($sourceBytes, 0, 3) === "\xFF\xD8\xFF";

            // 3. META VERİ: dönüştürmeden önce eksiksiz hafızaya alınır
            $rawMeta = $isJpegSource ? ImageMeta::extractJpeg($sourceBytes) : ['exif' => null, 'xmp' => null, 'icc' => null, 'iptc' => null];
            $exifStream = fopen('php://memory', 'r+b');
            fwrite($exifStream, $sourceBytes);
            rewind($exifStream);
            $exifRaw = @exif_read_data($exifStream, null, true);
            fclose($exifStream);
            $cleanExif = $this->parseExif($exifRaw ? $this->flattenExif($exifRaw) : false);
            $cleanExif['all'] = $exifRaw ? $this->sanitizeExif($exifRaw) : null;
            $cleanExif['meta'] = array_map(fn ($v) => $v !== null ? base64_encode($v) : null, $rawMeta);

            if (!empty($customGps)) {
                $gpsData = is_string($customGps) ? json_decode($customGps, true) : $customGps;
                if (!empty($gpsData) && isset($gpsData['lat']) && isset($gpsData['lon'])) {
                    $cleanExif['lat'] = (float) $gpsData['lat'];
                    $cleanExif['lon'] = (float) $gpsData['lon'];
                }
            }

            // 4. GÖRSEL İŞLEME (Intervention Image v3, bellekte)
            $driverObj = extension_loaded('imagick') ? new ImagickDriver() : new GdDriver();
            $manager = new ImageManager($driverObj);

            // A) Orijinal (filigransız): JPG ise ve boyutlandırma ayarı yoksa byte'ı byte'ına aynısı yüklenir
            if ($isJpegSource && !($origResize && (int) $origResize > 0)) {
                $origBytes = $sourceBytes;
            } else {
                $imgOrig = $manager->read($sourceBytes);
                if ($origResize && (int) $origResize > 0) {
                    $imgOrig->scaleDown(width: (int) $origResize);
                }
                $origBytes = (string) $imgOrig->toJpeg($origQuality);
                unset($imgOrig);
                // Yeniden kodlamada silinen meta veriyi geri yaz (pikseller döndürüldüğü için yön 1 yapılır)
                $origMeta = $rawMeta;
                if ($origMeta['exif']) $origMeta['exif'] = ImageMeta::patchExif($origMeta['exif'], [], [], true, true);
                $origBytes = ImageMeta::injectJpeg($origBytes, $origMeta);
            }

            // B) Ana Vitrin: boyutlandır, filigran ekle, WebP olarak kodla
            $imgMain = $manager->read($sourceBytes);
            $imgMain->scaleDown(width: $maxWidth);
            $this->applyWatermark($imgMain, $watermarkFilename, $actor, $targetUsername, $manager);

            $mainWidth = $imgMain->width();
            $mainHeight = $imgMain->height();
            $mainBytes = $extension === 'webp'
                ? ImageMeta::injectWebpIcc((string) $imgMain->toWebp($quality), $rawMeta['icc'], $mainWidth, $mainHeight)
                : ImageMeta::injectJpeg((string) $imgMain->toJpeg($quality), ['icc' => $rawMeta['icc']]);

            $thumbW = min((int) $thumbWidth, $mainWidth);
            $thumbH = $mainWidth > 0 ? (int) round($mainHeight * $thumbW / $mainWidth) : null;

            // C) Statik model: küçük boyutlar dosya olarak üretilir (dinamik modda hiç dosya üretilmez)
            $thumbBytes = $miniBytes = null;
            if (!$cdnDynamicResize) {
                $imgThumb = clone $imgMain;
                $imgThumb->scaleDown(width: $thumbWidth);
                $thumbBytes = $extension === 'webp' ? (string) $imgThumb->toWebp(82) : (string) $imgThumb->toJpeg(85);
                unset($imgThumb);

                $imgMini = clone $imgMain;
                $imgMini->scaleDown(width: $miniWidth);
                $miniBytes = $extension === 'webp' ? (string) $imgMini->toWebp(75) : (string) $imgMini->toJpeg(75);
                unset($imgMini);
            }

            unset($imgMain, $sourceBytes);

            // 5. BULUT YÜKLEME (Firebase Storage)
            $cloud = resolve(CloudStorage::class);
            $bucket = $cloud->bucket();

            $subDir = date('Y/m');
            $cloudFolder = $cloud->folder() . '/' . $subDir . '/';
            $cloudBaseUrl = $cloud->baseUrl();

            $put = function (string $bytes, string $name, string $mime, string $downloadName) use ($bucket, $cloudFolder, $cloudBaseUrl) {
                $bucket->upload($bytes, [
                    'name' => $cloudFolder . $name,
                    'predefinedAcl' => 'publicRead',
                    'resumable' => false,
                    'metadata' => [
                        'contentType' => $mime,
                        'cacheControl' => 'public, max-age=31536000',
                        'contentDisposition' => 'inline; filename="' . $downloadName . '"',
                    ],
                ]);

                return $cloudBaseUrl . '/' . $cloudFolder . rawurlencode($name);
            };

            $finalMainUrl = $put($mainBytes, $safeName, $mimeType, $cleanNameWithSpaces . '.' . $extension);
            $finalOrigUrl = $put($origBytes, $origSafeName, 'image/jpeg', $cleanNameWithSpaces . '_orijinal.jpg');
            unset($mainBytes, $origBytes);

            if ($thumbBytes !== null && $miniBytes !== null) {
                $finalThumbUrl = $put($thumbBytes, $thumbSafeName, $mimeType, $cleanNameWithSpaces . '_thumb.' . $extension);
                $finalMiniUrl = $put($miniBytes, $miniSafeName, $mimeType, $cleanNameWithSpaces . '_mini.' . $extension);
            } else {
                // Dinamik boyutlandırma: görsel sunucusu ?w= ile istenen genişliği üretir
                $finalThumbUrl = $finalMainUrl . '?w=' . $thumbWidth;
                $finalMiniUrl  = $finalMainUrl . '?w=' . $miniWidth;
            }

            // 7. KULLANICI AŞIRMA (IMPERSONATION) & VERİTABANI KAYDI
            $ownerId = $actor->id;
            if ($actor->isAdmin() && !empty($targetUsername)) {
                $targetUser = User::where('username', trim($targetUsername))->first();
                if ($targetUser) {
                    $ownerId = $targetUser->id;
                }
            }

            $imageModel = new FramioImage();
            $imageModel->user_id = $ownerId;
            $imageModel->filename = $cleanNameWithSpaces . '.' . $extension;
            $imageModel->path = $finalMainUrl;
            $imageModel->thumb_path = $finalThumbUrl; // Mesaj alanlarında hızlı yüklenen 1024px Thumbnail
            $imageModel->original_path = $finalOrigUrl;
            $imageModel->mime_type = $mimeType;
            // Seçilen imza hatırlanır (sosyal medyada orijinal üzerine aynı imza basılır)
            if ($watermarkFilename && $watermarkFilename !== 'none' && $imageModel->getConnection()->getSchemaBuilder()->hasColumn('framio_media_images', 'watermark')) {
                $imageModel->watermark = $watermarkFilename;
                $imageModel->watermark_owner = ($actor->isAdmin() && !empty($targetUsername)) ? trim($targetUsername) : $actor->username;
            }
            $imageModel->exif_data = json_encode($cleanExif);
            $imageModel->width = $mainWidth ?? null;
            $imageModel->height = $mainHeight ?? null;
            $imageModel->thumb_width = $thumbW ?? null;
            $imageModel->thumb_height = $thumbH ?? null;

            if (!empty($customMusic)) {
                $musicData = is_string($customMusic) ? json_decode($customMusic, true) : $customMusic;
                if (!empty($musicData)) {
                    $imageModel->music_data = json_encode($musicData);
                }
            }

            $imageModel->save();

            $activeTag = trim($this->settings->get('framio-upload-exif.active_bbcode_tag', 'framio-image') ?: 'framio-image');
            $activeTag = preg_replace('/[^a-zA-Z0-9_-]/', '', $activeTag);
            if (empty($activeTag)) $activeTag = 'framio-image';

            // BBCode'da thumb_path kullanıyoruz ki konu sayfaları süper hızlı açılsın!
            $bbcode = "[{$activeTag} id={$imageModel->id} url=\"{$imageModel->thumb_path}\" alt=\"{$displayAltText}\"]";

            return new JsonResponse([
                'id' => $imageModel->id,
                'url' => $imageModel->path,
                'thumb_url' => $imageModel->thumb_path,
                'original_url' => ($actor->isAdmin() || (int)$actor->id === (int)$ownerId) ? $imageModel->original_path : null,
                'bbcode' => $bbcode,
                'music_data' => $imageModel->music_data ? json_decode($imageModel->music_data, true) : null,
                'exif_data' => $cleanExif,
            ]);

        } catch (Throwable $e) {

            // Yakalanan hata Debug modülüne (Framio General) tam yığınıyla düşsün
            if (class_exists(\Framio\General\Debug\DebugLog::class)) {
                try {
                    resolve(\Framio\General\Debug\DebugLog::class)->recordException($e, $request);
                } catch (Throwable $ignored) {
                }
            }

            return new JsonResponse([
                'error' => 'Görsel işlenirken veya yüklenirken bir hata oluştu: ' . $e->getMessage()
            ], 500);
        }
    }

    protected function applyWatermark(&$image, $watermarkFilename, $actor, $targetUsername, $manager)
    {
        if ($watermarkFilename === 'none' || empty($watermarkFilename)) {
            return;
        }

        $baseWmDir = public_path('assets/watermarks');
        $validWmPath = null;

        if ($actor->isAdmin() && !empty($targetUsername)) {
            $candidate = $baseWmDir . '/' . trim($targetUsername) . '/' . $watermarkFilename;
            if (file_exists($candidate)) $validWmPath = $candidate;
        }

        if (!$validWmPath) {
            $userWm = $baseWmDir . '/' . $actor->username . '/' . $watermarkFilename;
            $globalWm = $baseWmDir . '/global/' . $watermarkFilename;
            $rootWm = $baseWmDir . '/' . $watermarkFilename;
            if (file_exists($userWm)) $validWmPath = $userWm;
            elseif (file_exists($globalWm)) $validWmPath = $globalWm;
            elseif (file_exists($rootWm)) $validWmPath = $rootWm;
        }

        if ($validWmPath) {
            $wm = $manager->read($validWmPath);
            $targetWidth = $image->width();
            $wm->scale(width: $targetWidth); // Her zaman tam genişlik: imza fotoğraftan darsa büyütülür, genişse küçültülür
            $image->place($wm, 'bottom');
            unset($wm);
        }
    }

    protected function parseExif($exif)
    {
        if (!is_array($exif)) return [];

        $clean = [];
        $clean['make'] = $exif['Make'] ?? null;
        $clean['model'] = $exif['Model'] ?? null;
        $clean['lens'] = $exif['UndefinedTag:0xA434'] ?? ($exif['LensModel'] ?? null);
        $clean['artist'] = $exif['Artist'] ?? null;
        $clean['software'] = $exif['Software'] ?? null;
        $clean['copyright'] = $exif['Copyright'] ?? null;
        $clean['description'] = $exif['ImageDescription'] ?? null;
        
        if (isset($exif['FNumber'])) {
            $clean['aperture'] = 'f/' . $this->solveFraction($exif['FNumber']);
        }
        if (isset($exif['ExposureTime'])) {
            $clean['exposure'] = $this->formatExposureTime($exif['ExposureTime']);
        }
        if (isset($exif['ISOSpeedRatings'])) {
            $clean['iso'] = is_array($exif['ISOSpeedRatings']) ? $exif['ISOSpeedRatings'][0] : $exif['ISOSpeedRatings'];
        }
        if (isset($exif['FocalLength'])) {
            $clean['focal'] = $this->solveFraction($exif['FocalLength']) . 'mm';
        }
        if (isset($exif['FocalLengthIn35mmFilm'])) {
            $clean['focal_35mm'] = (int)$exif['FocalLengthIn35mmFilm'] . 'mm';
        }
        if (isset($exif['DateTimeOriginal'])) {
            $clean['date'] = $exif['DateTimeOriginal'];
        }
        if (isset($exif['MeteringMode'])) {
            $clean['metering_mode'] = (int)$exif['MeteringMode'];
        }
        if (isset($exif['ExposureBiasValue'])) {
            $clean['exposure_bias'] = $this->solveFraction($exif['ExposureBiasValue']);
        }
        if (isset($exif['MaxApertureValue'])) {
            $clean['max_aperture'] = 'f/' . $this->solveFraction($exif['MaxApertureValue']);
        }
        if (isset($exif['Flash'])) {
            $clean['flash'] = (int)$exif['Flash'];
        }
        if (isset($exif['WhiteBalance'])) {
            $clean['white_balance'] = (int)$exif['WhiteBalance'];
        }
        if (isset($exif['ColorSpace'])) {
            $clean['color_space'] = (int)$exif['ColorSpace'];
        }
        if (isset($exif['ExposureProgram'])) {
            $clean['exposure_program'] = (int)$exif['ExposureProgram'];
        }
        if (isset($exif['SubjectDistance'])) {
            $clean['subject_distance'] = $this->solveFraction($exif['SubjectDistance']);
        }
        if (isset($exif['BrightnessValue'])) {
            $clean['brightness'] = $this->solveFraction($exif['BrightnessValue']);
        }
        if (isset($exif['LightSource'])) {
            $clean['light_source'] = (int)$exif['LightSource'];
        }
        if (isset($exif['Sharpness'])) {
            $clean['sharpness'] = (int)$exif['Sharpness'];
        }
        $clean['lens_make'] = $exif['LensMake'] ?? ($exif['UndefinedTag:0xA433'] ?? ($clean['make'] ?? null));
        $clean['body_serial'] = $exif['BodySerialNumber'] ?? ($exif['SerialNumber'] ?? ($exif['UndefinedTag:0xA431'] ?? null));
        $clean['exif_version'] = $exif['ExifVersion'] ?? '0232';

        // GPS
        if (isset($exif['GPSLatitude']) && isset($exif['GPSLongitude']) && isset($exif['GPSLatitudeRef']) && isset($exif['GPSLongitudeRef'])) {
            $clean['lat'] = $this->getGpsCoord($exif['GPSLatitude'], $exif['GPSLatitudeRef']);
            $clean['lon'] = $this->getGpsCoord($exif['GPSLongitude'], $exif['GPSLongitudeRef']);
        }

        return array_filter($clean);
    }

    protected function extractRawExifApp1(string $filePath): ?string
    {
        $handle = @fopen($filePath, 'rb');
        if (!$handle) return null;
        
        $soi = fread($handle, 2);
        if ($soi !== "\xFF\xD8") {
            fclose($handle);
            return null;
        }

        while (!feof($handle)) {
            $markerHeader = fread($handle, 2);
            if (strlen($markerHeader) < 2 || $markerHeader[0] !== "\xFF") {
                break;
            }
            $marker = ord($markerHeader[1]);
            if ($marker === 0xD8 || $marker === 0xD9 || ($marker >= 0xD0 && $marker <= 0xD7)) {
                continue;
            }
            $lenBytes = fread($handle, 2);
            if (strlen($lenBytes) < 2) break;
            $len = unpack('n', $lenBytes)[1];
            $payload = fread($handle, $len - 2);

            if ($marker === 0xE1) { // APP1
                if (substr($payload, 0, 6) === "Exif\x00\x00") {
                    fclose($handle);
                    return "\xFF\xE1" . $lenBytes . $payload;
                }
            } elseif ($marker === 0xDA) { // SOS
                break;
            }
        }
        fclose($handle);
        return null;
    }

    /** Bölümlü exif_read_data çıktısını parseExif'in beklediği düz yapıya çevirir */
    protected function flattenExif(array $sections): array
    {
        $flat = [];
        foreach ($sections as $name => $tags) {
            if ($name === 'COMPUTED' || $name === 'THUMBNAIL' || !is_array($tags)) continue;
            $flat = array_merge($flat, $tags);
        }
        $flat['COMPUTED'] = $sections['COMPUTED'] ?? [];

        return $flat;
    }

    /**
     * Okunabilen bütün EXIF etiketleri (bölüm bölüm). İkili veriler (üretici notları vb.) burada tutulmaz;
     * onlar ham EXIF bloğunda (meta.exif) eksiksiz saklanır.
     */
    protected function sanitizeExif($value, int $depth = 0)
    {
        if (is_array($value)) {
            $out = [];
            foreach ($value as $k => $v) {
                if ($depth === 0 && $k === 'THUMBNAIL') continue;
                $clean = $this->sanitizeExif($v, $depth + 1);
                if ($clean !== null) $out[$k] = $clean;
            }
            return $out;
        }
        if (is_string($value)) {
            if (strlen($value) > 2000 || !mb_check_encoding($value, 'UTF-8') || preg_match('/[\x00-\x08\x0E-\x1F]/', rtrim($value, "\x00"))) {
                return null;
            }
            return rtrim($value, "\x00");
        }

        return $value;
    }

    protected function formatExposureTime($val)
    {
        if (empty($val)) return null;
        if (is_numeric($val)) {
            $num = (float)$val;
            if ($num <= 0) return null;
            if ($num < 1) {
                $denom = round(1 / $num);
                return "1/{$denom}s";
            }
            return round($num, 1) . 's';
        }
        $parts = explode('/', $val);
        if (count($parts) === 2 && $parts[1] != 0) {
            $n = (float)$parts[0];
            $d = (float)$parts[1];
            if ($n == 0) return null;
            $sec = $n / $d;
            if ($sec < 1) {
                $denom = round($d / $n);
                return "1/{$denom}s";
            }
            return round($sec, 1) . 's';
        }
        return $val . 's';
    }

    protected function solveFraction($fraction)
    {
        if (is_numeric($fraction)) return $fraction;
        $parts = explode('/', $fraction);
        if (count($parts) === 2 && $parts[1] != 0) {
            return round($parts[0] / $parts[1], 2);
        }
        return $fraction;
    }

    protected function getGpsCoord($coordinate, $hemisphere)
    {
        if (!is_array($coordinate)) return 0;
        for ($i = 0; $i < 3; $i++) {
            $part = $coordinate[$i];
            $parts = explode('/', $part);
            if (count($parts) <= 0) return 0;
            if (count($parts) == 1) $coordinate[$i] = $parts[0];
            else $coordinate[$i] = floatval($parts[0]) / floatval($parts[1]);
        }
        $degrees = $coordinate[0];
        $minutes = $coordinate[1];
        $seconds = $coordinate[2];
        $sign = ($hemisphere == 'W' || $hemisphere == 'S') ? -1 : 1;
        return $sign * ($degrees + ($minutes / 60) + ($seconds / 3600));
    }
}
