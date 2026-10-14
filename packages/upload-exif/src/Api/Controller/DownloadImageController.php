<?php

namespace Framio\UploadExif\Api\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response;
use Laminas\Diactoros\Stream;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Http\UrlGenerator;
use Flarum\User\User;
use Flarum\Post\Post;
use Framio\UploadExif\Database\FramioImage;
use Framio\UploadExif\Image\ImageMeta;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Drivers\Imagick\Driver as ImagickDriver;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Throwable;

class DownloadImageController implements RequestHandlerInterface
{
    protected $settings;
    protected $url;

    public function __construct(SettingsRepositoryInterface $settings, UrlGenerator $url)
    {
        $this->settings = $settings;
        $this->url = $url;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $id = Arr::get($request->getQueryParams(), 'id');
        $image = FramioImage::findOrFail($id);

        // Eski kayıtlarda adres ham boşluk/Türkçe karakter içerebilir; yol parçaları güvenli biçimde kodlanır
        $imageUrl = preg_replace_callback('~(?<=/)[^/?#]+~', fn ($m) => rawurlencode(rawurldecode($m[0])), preg_replace('/\?.*$/', '', (string) $image->path));
        $rawFilename = $image->filename ?: ('ulasim_' . $image->id . '.jpg');
        $baseName = pathinfo($rawFilename, PATHINFO_FILENAME);
        $cleanBaseName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $baseName);

        // Fetch raw image content
        $content = @file_get_contents($imageUrl);
        if (!$content && function_exists('curl_init')) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $imageUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
            $content = curl_exec($ch);
            curl_close($ch);
        }

        if (!$content) {
            $res = new Response();
            return $res->withStatus(404);
        }

        // Ayarları Oku
        $jpgQuality = (int) ($this->settings->get('framio-upload-exif.download_jpg_quality', 95) ?: 95);

        // İlgili Post ve Tartışma Bilgilerini Çek
        $post = null;
        try {
            $post = Post::where('content', 'LIKE', '%id="' . $image->id . '"%')
                ->orWhere('content', 'LIKE', '%id=' . $image->id . '%')
                ->orderBy('id', 'desc')
                ->first();
        } catch (Throwable $e) {}

        $forumTitle = $this->settings->get('forum_title', 'Ulaşım Forum');
        $forumUrl   = rtrim($this->url->to('forum')->base(), '/');

        $imageTitle = $image->title;
        $kunyeItems = [];
        $postUrl    = $forumUrl;
        $discussionUrl = $forumUrl;

        if ($post) {
            $contentHtml = $post->content;
            if (empty($imageTitle)) {
                if (preg_match('/alt="([^"]+)"/i', $contentHtml, $m)) {
                    $imageTitle = trim($m[1]);
                }
            }
            // Künye maddeleri forumdaki haliyle alınır: yalnızca BBCode/Markdown işaretleri (<s>…</s>, <e>…</e>)
            // atılır; metnin kendisindeki tire, yıldız, ayraç vb. olduğu gibi kalır.
            // Künye ya [framio-kunye] bloğu ya da görselin ardından gelen madde listesidir (sitelere göre).
            // Çoklu künyeli gönderide bu görselden SONRA gelen ilk künye bloğu kullanılır.
            $pattern = preg_match('/<FRAMIO-KUNYE/i', $contentHtml) ? '/<FRAMIO-KUNYE[^>]*>(.*?)<\/FRAMIO-KUNYE>/is' : '/<LIST[^>]*>(.*?)<\/LIST>/is';
            if (preg_match_all($pattern, $contentHtml, $blocks, PREG_OFFSET_CAPTURE)) {
                $imagePos = $this->imagePosition($contentHtml, $image);
                $block = $blocks[1][0][0];
                if ($imagePos !== null) {
                    foreach ($blocks[1] as [$text, $offset]) {
                        if ($offset > $imagePos) { $block = $text; break; }
                    }
                }
                $items = preg_match_all('/<LI[^>]*>(.*?)<\/LI>/is', $block, $lim) ? $lim[1] : preg_split('/<br\s*\/?>|\n/i', $block);
                foreach ($items as $item) {
                    $item = preg_replace('/<(s|e)>.*?<\/\1>/is', '', $item);
                    $cleanItem = trim(html_entity_decode(strip_tags($item), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                    if ($cleanItem !== '') {
                        $kunyeItems[] = $cleanItem;
                    }
                }
            }
            $discussion = $post->discussion;
            if ($discussion) {
                $postUrl = $forumUrl . '/d/' . $discussion->id . '-' . $discussion->slug . '/' . $post->number;
                $discussionUrl = $forumUrl . '/d/' . $discussion->id . '-' . $discussion->slug;
            }
        }

        if (empty($imageTitle)) {
            $imageTitle = $cleanBaseName;
        }

        $kunyeInline = !empty($kunyeItems) ? implode(' | ', $kunyeItems) : ($image->description ?: $imageTitle);
        // Forumdaki satır düzeni korunur (madde işareti eklenmez)
        $kunyeFormatted = !empty($kunyeItems) ? implode("\n", $kunyeItems) : $kunyeInline;

        $user = $image->user_id ? User::find($image->user_id) : ($post && $post->user ? $post->user : null);
        $authorName = $user ? ($user->display_name ?: $user->username) : 'Ulaşım Fotoğrafçısı';
        $dateStr    = $image->created_at ? $image->created_at->format('d.m.Y H:i') : date('d.m.Y H:i');

        // EXIF verilerini çek ve hazırla
        $exifData = [];
        if (!empty($image->exif_data)) {
            $exifData = is_string($image->exif_data) ? (json_decode($image->exif_data, true) ?: []) : $image->exif_data;
        }

        // Sanatçı adı: Fotoğrafın içindeki orijinal artist varsa onu kullan, yoksa üye adı
        $photographer = !empty($exifData['artist']) ? $exifData['artist'] : $authorName;

        // Meta veri şablonları
        $titleTpl     = $this->settings->get('framio-upload-exif.download_meta_title', '{title} | {forum_title}');
        $subjectTpl   = $this->settings->get('framio-upload-exif.download_meta_subject', '{kunye_inline} - {post_url}');
        $commentTpl   = $this->settings->get('framio-upload-exif.download_meta_comment', "{title}\n\nKünye Bilgileri:\n{kunye_formatted}\n\nFotoğrafı Çeken: {author}\nKaynak: {post_url}\nTelif Hakkı: © {author} | {forum_title} ({forum_url})");
        $authorTpl    = $this->settings->get('framio-upload-exif.download_meta_author', '{author}');
        $copyrightTpl = $this->settings->get('framio-upload-exif.download_meta_copyright', '© {author} | {forum_title} ({forum_url})');
        $tagsTpl      = $this->settings->get('framio-upload-exif.download_meta_tags', '');

        $replacements = [
            '{title}'           => $imageTitle,
            '{kunye_inline}'    => $kunyeInline,
            '{kunye_formatted}' => $kunyeFormatted,
            '{post_url}'        => $postUrl,
            '{discussion_url}'  => $discussionUrl,
            '{filename}'        => $rawFilename,
            '{author}'          => $photographer,
            '{description}'     => $image->description ?: $kunyeInline,
            '{forum_title}'     => $forumTitle,
            '{forum_url}'       => $forumUrl,
            '{date}'            => $dateStr
        ];

        $finalTitle     = trim(str_replace(array_keys($replacements), array_values($replacements), $titleTpl));
        $finalSubject   = trim(str_replace(array_keys($replacements), array_values($replacements), $subjectTpl));
        $finalComment   = trim(str_replace(array_keys($replacements), array_values($replacements), $commentTpl));
        $finalAuthor    = trim(str_replace(array_keys($replacements), array_values($replacements), $authorTpl));
        $finalCopyright = trim(str_replace(array_keys($replacements), array_values($replacements), $copyrightTpl));
        $finalTags      = trim(str_replace(array_keys($replacements), array_values($replacements), $tagsTpl));

        $exifData['artist']      = $finalAuthor;
        $exifData['copyright']   = $finalCopyright;
        $exifData['description'] = $finalTitle;
        if (empty($exifData['software'])) {
            $exifData['software'] = 'Framio Media Engine';
        }

        // Windows XP Etiketleri (Ayrıntılar sekmesi)
        $exifData['xp_title']    = $finalTitle;
        $exifData['xp_subject']  = $finalSubject;
        $exifData['xp_comment']  = $finalComment;
        $exifData['xp_author']   = $finalAuthor;
        $exifData['xp_keywords'] = $finalTags;

        // İndirme biçimi: istekte ?format=jpg|webp; yoksa admin ayarı (sor | jpg | webp). "sor" modunda varsayılan JPG.
        $mode = $this->settings->get('framio-upload-exif.download_format_mode')
            ?: ($this->settings->get('framio-upload-exif.download_convert_jpg', '1') === '0' ? 'webp' : 'ask');
        $requested = strtolower((string) Arr::get($request->getQueryParams(), 'format', ''));
        $format = in_array($requested, ['jpg', 'webp'], true) && $mode === 'ask'
            ? $requested
            : ($mode === 'webp' ? 'webp' : 'jpg');

        $iptcTags = [
            '2:05'  => $finalTitle,     // Başlık (Object Name)
            '2:105' => $finalSubject,   // Konu (Headline)
            '2:120' => $finalComment,   // Açıklamalar (Caption / Comments)
            '2:80'  => $finalAuthor,    // Yazar (Byline)
            '2:116' => $finalCopyright, // Telif Hakkı (Copyright)
        ];
        if ($finalTags) {
            $iptcTags['2:25'] = array_map('trim', explode(',', $finalTags));
        }

        // Yüklemede eksiksiz saklanan ham meta veri (EXIF, XMP, ICC, IPTC)
        $raw = array_map(fn ($v) => $v ? base64_decode($v) : null, (array) ($exifData['meta'] ?? []));

        // EXIF: ham blok olduğu gibi korunur, yalnızca başlık/yazar/telif ve Windows etiketleri eklenir.
        // Ham blok yoksa (eski görseller) seçilmiş alanlardan yeni EXIF kurulur.
        $tiff = !empty($raw['exif']) ? ImageMeta::patchExif($raw['exif'], [
            0x010E => $finalTitle,
            0x013B => $finalAuthor,
            0x8298 => $finalCopyright,
        ], [
            0x9C9B => $finalTitle,
            0x9C9C => $finalComment,
            0x9C9D => $finalAuthor,
            0x9C9E => $finalTags,
            0x9C9F => $finalSubject,
        ]) : null;
        if ($tiff === null) {
            $tiff = substr($this->buildExifApp1($exifData), 10);
        }

        $downloadName = $this->downloadFilename($replacements, $image);
        $output = null;

        try {
            $driver = extension_loaded('imagick') ? new ImagickDriver() : new GdDriver();
            $manager = new ImageManager($driver);
            $imgObj = $manager->read($content);
            $width = $imgObj->width();
            $height = $imgObj->height();

            if ($format === 'webp') {
                // Kaynak zaten WebP ise yeniden kodlanmaz (kalite kaybı olmaz); yalnızca meta veri eklenir
                $webp = substr($content, 0, 4) === 'RIFF' ? $content : (string) $imgObj->toWebp($jpgQuality);
                $output = ImageMeta::injectWebpMeta($webp, ['exif' => $tiff, 'xmp' => $raw['xmp'] ?? null, 'icc' => $raw['icc'] ?? null], $width, $height);
                $mime = 'image/webp';
            } else {
                $output = ImageMeta::injectJpeg((string) $imgObj->toJpeg($jpgQuality), [
                    'exif' => $tiff,
                    'xmp' => $raw['xmp'] ?? null,
                    'icc' => $raw['icc'] ?? null,
                    'iptc' => ImageMeta::buildIptc($iptcTags, $raw['iptc'] ?? null),
                ]);
                $mime = 'image/jpeg';
            }
            unset($imgObj);
        } catch (Throwable $e) {
            // İşlenemezse dosya olduğu gibi verilir
            $output = $content;
            $mime = substr($content, 0, 4) === 'RIFF' ? 'image/webp' : 'image/jpeg';
            $format = $mime === 'image/webp' ? 'webp' : 'jpg';
        }

        $fileName = $downloadName . '.' . $format;
        $asciiName = Str::ascii($fileName);
        $asciiName = preg_replace('/[^A-Za-z0-9._ ()-]/', '_', $asciiName) ?: ('foto_' . $image->id . '.' . $format);

        $body = fopen('php://memory', 'r+');
        fwrite($body, $output);
        rewind($body);

        return new Response(new Stream($body), 200, [
            'Content-Type' => $mime,
            // ASCII yedek ad + UTF-8 asıl ad (Türkçe karakterli adlar için)
            'Content-Disposition' => 'attachment; filename="' . $asciiName . '"; filename*=UTF-8\'\'' . rawurlencode($fileName),
            'Content-Length' => (string) strlen($output),
            'Cache-Control' => 'no-cache, must-revalidate',
        ]);
    }

    /** Görselin gönderi XML'indeki konumu: önce BBCode kimliği (id="N"), yoksa dosya adının zaman damgalı gövdesi */
    protected function imagePosition(string $xml, FramioImage $image): ?int
    {
        if (preg_match('/<[A-Z][A-Z0-9-]*\b[^>]*\bid="?' . (int) $image->id . '"?[\s>\/]/i', $xml, $m, PREG_OFFSET_CAPTURE)) {
            return $m[0][1];
        }
        $stem = preg_replace('/\.(jpe?g|webp|png)$/i', '', rawurldecode(basename((string) parse_url((string) $image->path, PHP_URL_PATH))));
        if ($stem !== '' && preg_match('/^\d{9,}/', $stem, $ts)) {
            $pos = strpos($xml, $ts[0]);
            return $pos === false ? null : $pos;
        }

        return null;
    }

    /**
     * İndirilen dosyanın adı (uzantısız). Admin panelindeki şablondan üretilir:
     *   framio-upload-exif.download_filename_template  örn. "{title}" veya "{kunye_inline} - {forum_title}"
     *   framio-upload-exif.download_filename_style     unicode (Türkçe karakterler korunur) | ascii | slug
     *   framio-upload-exif.download_filename_max       en fazla karakter (varsayılan 120)
     */
    protected function downloadFilename(array $replacements, FramioImage $image): string
    {
        $template = trim((string) $this->settings->get('framio-upload-exif.download_filename_template')) ?: '{title}';
        $style = $this->settings->get('framio-upload-exif.download_filename_style') ?: 'unicode';
        $max = max(20, min(200, (int) ($this->settings->get('framio-upload-exif.download_filename_max') ?: 120)));

        $values = $replacements + [
            '{id}' => (string) $image->id,
            '{date_ymd}' => $image->created_at ? $image->created_at->format('Y-m-d') : date('Y-m-d'),
            '{original_name}' => pathinfo((string) $image->filename, PATHINFO_FILENAME),
        ];
        // Çok satırlı değerler tek satıra indirilir
        $values = array_map(fn ($v) => trim(preg_replace('/\s+/u', ' ', (string) $v)), $values);
        $name = str_replace(array_keys($values), array_values($values), $template);

        // Dosya sistemlerinde yasak karakterler
        $name = preg_replace('~[\\\\/:*?"<>|\x00-\x1F]+~u', ' ', $name);
        $name = trim(preg_replace('/\s+/u', ' ', $name), " .-_");

        if ($style === 'ascii') {
            $name = trim(preg_replace('/[^A-Za-z0-9 ()._-]+/', ' ', Str::ascii($name)));
            $name = preg_replace('/\s+/', ' ', $name);
        } elseif ($style === 'slug') {
            $name = Str::slug(Str::ascii($name), '-');
        }

        $name = rtrim(mb_substr($name, 0, $max), " .-_");

        return $name !== '' ? $name : 'foto_' . $image->id;
    }

    /**
     * Standart TIFF EXIF APP1 binary segmenti oluşturur.
     * Tüm kamera etiketlerini ve Windows XP metadata etiketlerini TIFF standardına uygun sıralı olarak yazar.
     */
    protected function buildExifApp1(array $data): string
    {
        // Little Endian (II)
        $tiff = "II*\x00\x08\x00\x00\x00"; // 8 bytes TIFF header
        $dataPool = '';

        $ifd0Entries = [];
        $exifEntries = [];
        $gpsEntries = [];

        // Helper to add ASCII entry
        $addAscii = function(&$entries, $tag, $string) use (&$dataPool) {
            if ($string === null || $string === '') return;
            $val = $string . "\x00";
            $len = strlen($val);
            $pos = strlen($dataPool);
            $dataPool .= $val;
            if ($len % 2 !== 0) $dataPool .= "\x00"; // 2-byte align
            $entries[] = [
                'tag' => $tag,
                'type' => 2, // ASCII
                'count' => $len,
                'dataOffset' => $pos
            ];
        };

        // Helper to add Windows XP UTF-16LE string entry (Tag Type 1: BYTE)
        $addXpString = function(&$entries, $tag, $string) use (&$dataPool) {
            if ($string === null || $string === '') return;
            $utf16 = iconv('UTF-8', 'UTF-16LE', $string) . "\x00\x00";
            $len = strlen($utf16);
            $pos = strlen($dataPool);
            $dataPool .= $utf16;
            if ($len % 2 !== 0) $dataPool .= "\x00";
            $entries[] = [
                'tag' => $tag,
                'type' => 1, // BYTE
                'count' => $len,
                'dataOffset' => $pos
            ];
        };

        // Helper to add Rational entry (numerator, denominator)
        $addRational = function(&$entries, $tag, $num, $den) use (&$dataPool) {
            $pos = strlen($dataPool);
            $dataPool .= pack('VV', (int)$num, (int)$den);
            $entries[] = [
                'tag' => $tag,
                'type' => 5, // RATIONAL
                'count' => 1,
                'dataOffset' => $pos
            ];
        };

        // Helper to add Signed Rational entry
        $addSignedRational = function(&$entries, $tag, $num, $den) use (&$dataPool) {
            $pos = strlen($dataPool);
            $dataPool .= pack('ll', (int)$num, (int)$den);
            $entries[] = [
                'tag' => $tag,
                'type' => 10, // SRATIONAL
                'count' => 1,
                'dataOffset' => $pos
            ];
        };

        // Helper to add Short entry (<= 2 shorts can fit in 4 bytes offset)
        $addShort = function(&$entries, $tag, $val) {
            $entries[] = [
                'tag' => $tag,
                'type' => 3, // SHORT
                'count' => 1,
                'value' => (int)$val
            ];
        };

        // IFD0 entries
        if (!empty($data['description'])) $addAscii($ifd0Entries, 0x010E, $data['description']);
        if (!empty($data['make'])) $addAscii($ifd0Entries, 0x010F, $data['make']);
        if (!empty($data['model'])) $addAscii($ifd0Entries, 0x0110, $data['model']);
        if (!empty($data['software'])) $addAscii($ifd0Entries, 0x0131, $data['software']);
        if (!empty($data['artist'])) $addAscii($ifd0Entries, 0x013B, $data['artist']);
        if (!empty($data['copyright'])) $addAscii($ifd0Entries, 0x8298, $data['copyright']);

        // Windows XP Tags (0x9C9B: Title, 0x9C9C: Comments, 0x9C9D: Author, 0x9C9E: Keywords, 0x9C9F: Subject)
        if (!empty($data['xp_title'])) $addXpString($ifd0Entries, 0x9C9B, $data['xp_title']);
        if (!empty($data['xp_comment'])) $addXpString($ifd0Entries, 0x9C9C, $data['xp_comment']);
        if (!empty($data['xp_author'])) $addXpString($ifd0Entries, 0x9C9D, $data['xp_author']);
        if (!empty($data['xp_keywords'])) $addXpString($ifd0Entries, 0x9C9E, $data['xp_keywords']);
        if (!empty($data['xp_subject'])) $addXpString($ifd0Entries, 0x9C9F, $data['xp_subject']);

        // ExifIFD entries
        if (!empty($data['exposure'])) {
            $exp = str_replace('s', '', $data['exposure']);
            if (strpos($exp, '/') !== false) {
                [$n, $d] = explode('/', $exp);
                $addRational($exifEntries, 0x829A, (int)$n, (int)$d);
            } else {
                $val = (float)$exp;
                $addRational($exifEntries, 0x829A, (int)round($val * 1000), 1000);
            }
        }

        if (!empty($data['aperture'])) {
            $ap = (float)str_replace('f/', '', $data['aperture']);
            $addRational($exifEntries, 0x829D, (int)round($ap * 10), 10);
        }

        if (isset($data['exposure_program'])) {
            $addShort($exifEntries, 0x8822, (int)$data['exposure_program']);
        }

        if (!empty($data['iso'])) {
            $addShort($exifEntries, 0x8827, (int)$data['iso']);
        }

        // ExifVersion (0x9000)
        $addUndefined4 = function(&$entries, $tag, $val4bytes) {
            $entries[] = [
                'tag' => $tag,
                'type' => 7, // UNDEFINED
                'count' => 4,
                'value' => unpack('V', str_pad(substr($val4bytes, 0, 4), 4, "\x00"))[1]
            ];
        };
        $addUndefined4($exifEntries, 0x9000, !empty($data['exif_version']) ? $data['exif_version'] : '0232');

        if (!empty($data['date'])) {
            $d = $data['date'];
            if (preg_match('/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/', $d, $m)) {
                $d = "{$m[3]}:{$m[2]}:{$m[1]} " . (strlen($m[4]) === 5 ? $m[4].':00' : $m[4]);
            }
            $addAscii($exifEntries, 0x9003, $d); // DateTimeOriginal
            $addAscii($exifEntries, 0x9004, $d); // DateTimeDigitized
        }

        // BrightnessValue (0x9203)
        if (isset($data['brightness']) && $data['brightness'] !== '') {
            $bv = (float)$data['brightness'];
            $addSignedRational($exifEntries, 0x9203, (int)round($bv * 100), 100);
        }

        // ExposureBiasValue (0x9204)
        $bias = isset($data['exposure_bias']) ? (float)$data['exposure_bias'] : 0;
        $addSignedRational($exifEntries, 0x9204, (int)round($bias * 100), 100);

        if (!empty($data['max_aperture'])) {
            $maxAp = (float)str_replace('f/', '', $data['max_aperture']);
            $addRational($exifEntries, 0x9205, (int)round($maxAp * 10), 10);
        }

        if (isset($data['metering_mode'])) {
            $addShort($exifEntries, 0x9207, (int)$data['metering_mode']);
        }

        // LightSource (0x9208)
        $lightSource = isset($data['light_source']) ? (int)$data['light_source'] : 0;
        $addShort($exifEntries, 0x9208, $lightSource);

        // Flash (0x9209)
        $flash = isset($data['flash']) ? (int)$data['flash'] : 0;
        $addShort($exifEntries, 0x9209, $flash);

        if (!empty($data['focal'])) {
            $foc = (float)str_replace('mm', '', $data['focal']);
            $addRational($exifEntries, 0x920A, (int)round($foc * 10), 10);
        }

        if (isset($data['color_space'])) {
            $addShort($exifEntries, 0xA001, (int)$data['color_space']);
        } else {
            $addShort($exifEntries, 0xA001, 1); // 1 = sRGB
        }

        if (!empty($data['focal_35mm'])) {
            $foc35 = (int)str_replace('mm', '', $data['focal_35mm']);
            $addShort($exifEntries, 0xA405, $foc35);
        }

        // WhiteBalance (0xA403)
        $wb = isset($data['white_balance']) ? (int)$data['white_balance'] : 0;
        $addShort($exifEntries, 0xA403, $wb);

        // Sharpness (0xA40A)
        $sharpness = isset($data['sharpness']) ? (int)$data['sharpness'] : 0;
        $addShort($exifEntries, 0xA40A, $sharpness);

        // BodySerialNumber (0xA431)
        if (!empty($data['body_serial'])) {
            $addAscii($exifEntries, 0xA431, $data['body_serial']);
        }

        // LensMake (0xA433)
        $lensMake = !empty($data['lens_make']) ? $data['lens_make'] : ($data['make'] ?? null);
        if (!empty($lensMake)) {
            $addAscii($exifEntries, 0xA433, $lensMake);
        }

        if (!empty($data['lens'])) {
            $addAscii($exifEntries, 0xA434, $data['lens']); // LensModel
        }

        // GPS IFD entries
        if (!empty($data['lat']) && !empty($data['lon'])) {
            $lat = (float)$data['lat'];
            $lon = (float)$data['lon'];
            
            $latRef = $lat >= 0 ? 'N' : 'S';
            $lonRef = $lon >= 0 ? 'E' : 'W';
            $lat = abs($lat);
            $lon = abs($lon);

            $addAscii($gpsEntries, 0x0001, $latRef); // GPSLatitudeRef
            $addAscii($gpsEntries, 0x0003, $lonRef); // GPSLongitudeRef

            // Lat DMS
            $latDeg = floor($lat);
            $latMin = floor(($lat - $latDeg) * 60);
            $latSec = round((($lat - $latDeg) * 60 - $latMin) * 60 * 1000);
            $pos = strlen($dataPool);
            $dataPool .= pack('VVVVVV', (int)$latDeg, 1, (int)$latMin, 1, (int)$latSec, 1000);
            $gpsEntries[] = ['tag' => 0x0002, 'type' => 5, 'count' => 3, 'dataOffset' => $pos];

            // Lon DMS
            $lonDeg = floor($lon);
            $lonMin = floor(($lon - $lonDeg) * 60);
            $lonSec = round((($lon - $lonDeg) * 60 - $lonMin) * 60 * 1000);
            $pos = strlen($dataPool);
            $dataPool .= pack('VVVVVV', (int)$lonDeg, 1, (int)$lonMin, 1, (int)$lonSec, 1000);
            $gpsEntries[] = ['tag' => 0x0004, 'type' => 5, 'count' => 3, 'dataOffset' => $pos];
        }

        // Offsets
        $ifd0Count = count($ifd0Entries) + (!empty($exifEntries) ? 1 : 0) + (!empty($gpsEntries) ? 1 : 0);
        $ifd0Size = 2 + ($ifd0Count * 12) + 4;

        $exifIfdOffset = 8 + $ifd0Size;
        $exifIfdSize = !empty($exifEntries) ? (2 + (count($exifEntries) * 12) + 4) : 0;

        $gpsIfdOffset = $exifIfdOffset + $exifIfdSize;
        $gpsIfdSize = !empty($gpsEntries) ? (2 + (count($gpsEntries) * 12) + 4) : 0;

        $baseDataPoolOffset = $gpsIfdOffset + $gpsIfdSize;

        if (!empty($exifEntries)) {
            $ifd0Entries[] = ['tag' => 0x8769, 'type' => 4, 'count' => 1, 'value' => $exifIfdOffset]; // ExifIFD Pointer
        }
        if (!empty($gpsEntries)) {
            $ifd0Entries[] = ['tag' => 0x8825, 'type' => 4, 'count' => 1, 'value' => $gpsIfdOffset]; // GPS IFD Pointer
        }

        // CRITICAL: Sort IFD entries by tag ASCENDING according to TIFF specification
        usort($ifd0Entries, fn($a, $b) => $a['tag'] <=> $b['tag']);
        usort($exifEntries, fn($a, $b) => $a['tag'] <=> $b['tag']);
        usort($gpsEntries, fn($a, $b) => $a['tag'] <=> $b['tag']);

        // Build IFD0
        $ifd0Binary = pack('v', count($ifd0Entries));
        foreach ($ifd0Entries as $entry) {
            $offsetVal = isset($entry['dataOffset']) ? ($baseDataPoolOffset + $entry['dataOffset']) : ($entry['value'] ?? 0);
            $ifd0Binary .= pack('vvVV', $entry['tag'], $entry['type'], $entry['count'], $offsetVal);
        }
        $ifd0Binary .= pack('V', 0); // Next IFD (0)

        // Build ExifIFD
        $exifIfdBinary = '';
        if (!empty($exifEntries)) {
            $exifIfdBinary = pack('v', count($exifEntries));
            foreach ($exifEntries as $entry) {
                $offsetVal = isset($entry['dataOffset']) ? ($baseDataPoolOffset + $entry['dataOffset']) : ($entry['value'] ?? 0);
                $exifIfdBinary .= pack('vvVV', $entry['tag'], $entry['type'], $entry['count'], $offsetVal);
            }
            $exifIfdBinary .= pack('V', 0);
        }

        // Build GPS IFD
        $gpsIfdBinary = '';
        if (!empty($gpsEntries)) {
            $gpsIfdBinary = pack('v', count($gpsEntries));
            foreach ($gpsEntries as $entry) {
                $offsetVal = isset($entry['dataOffset']) ? ($baseDataPoolOffset + $entry['dataOffset']) : ($entry['value'] ?? 0);
                $gpsIfdBinary .= pack('vvVV', $entry['tag'], $entry['type'], $entry['count'], $offsetVal);
            }
            $gpsIfdBinary .= pack('V', 0);
        }

        $payload = $tiff . $ifd0Binary . $exifIfdBinary . $gpsIfdBinary . $dataPool;
        $app1Length = strlen($payload) + 2 + 6; // 2 bytes length + 6 bytes "Exif\0\0"
        return "\xFF\xE1" . pack('n', $app1Length) . "Exif\x00\x00" . $payload;
    }

    /**
     * JPEG verisine EXIF (APP1) ve IPTC (APP13) segmentlerini enjekte eder.
     */
    protected function injectExifAndIptc(string $jpegData, array $exifData, array $iptcTags): string
    {
        $app1 = $this->buildExifApp1($exifData);
        
        // Strip existing APP0 / APP1 markers and insert new APP1 directly after SOI (\xFF\xD8)
        if (substr($jpegData, 0, 2) === "\xFF\xD8") {
            $pos = 2;
            $len = strlen($jpegData);
            while ($pos < $len && substr($jpegData, $pos, 1) === "\xFF") {
                $marker = ord(substr($jpegData, $pos + 1, 1));
                if ($marker === 0xE0 || $marker === 0xE1) { // APP0 or APP1
                    $segLen = unpack('n', substr($jpegData, $pos + 2, 2))[1];
                    $pos += 2 + $segLen;
                } else {
                    break;
                }
            }
            $jpegData = "\xFF\xD8" . $app1 . substr($jpegData, $pos);
        }

        // Embed IPTC (APP13) via temp file
        $tempFile = tempnam(sys_get_temp_dir(), 'iptc_') . '.jpg';
        file_put_contents($tempFile, $jpegData);

        $iptcBlock = $this->createIptcBlock($iptcTags);
        $result = @iptcembed($iptcBlock, $tempFile, 0);
        @unlink($tempFile);

        return ($result && is_string($result)) ? $result : $jpegData;
    }

    /**
     * IPTC binary bloğunu oluşturur.
     */
    protected function createIptcBlock(array $tags): string
    {
        $iptc = "\x1c\x01\x5a\x00\x03\x1b\x25\x47"; // UTF-8 (1:90)
        foreach ($tags as $tag => $val) {
            if ($val === null || $val === '') continue;
            [$record, $dataset] = explode(':', $tag);
            $vals = is_array($val) ? $val : [$val];
            foreach ($vals as $v) {
                $v = (string)$v;
                $vLen = strlen($v);
                $iptc .= "\x1c" . chr((int)$record) . chr((int)$dataset) . chr($vLen >> 8) . chr($vLen & 0xff) . $v;
            }
        }
        return $iptc;
    }
}
