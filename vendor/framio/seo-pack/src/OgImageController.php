<?php

namespace Framio\SeoPack;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response;
use Flarum\Discussion\DiscussionRepository;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Http\UrlGenerator;
use Framio\SeoPack\Helpers\MediaTagParser;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class OgImageController implements RequestHandlerInterface
{
    protected DiscussionRepository $discussions;
    protected SettingsRepositoryInterface $settings;
    protected UrlGenerator $url;

    public function __construct(
        DiscussionRepository $discussions,
        SettingsRepositoryInterface $settings,
        UrlGenerator $url
    ) {
        $this->discussions = $discussions;
        $this->settings = $settings;
        $this->url = $url;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $params = $request->getQueryParams();
        $id = (int)Arr::get($params, 'id', Arr::get($request->getAttributes(), 'id', 0));

        if (!$id) {
            return new Response\EmptyResponse(404);
        }

        try {
            $discussion = $this->discussions->findOrFail($id);
            $baseUrl = rtrim($this->url->to('forum')->base(), '/');
            $forumTitle = resolve(\Framio\SeoPack\Support\SeoSettings::class)->siteName();
            $customTags = $this->settings->get('framio-seo.recognized_tags');

            // Konudaki mesajları tara (Görsel ve künyeyi içeren mesajı bul)
            $posts = $discussion->posts()->where('type', 'comment')->whereNull('hidden_at')->orderBy('number', 'asc')->limit(15)->get();

            $matchedPost = null;
            $allImages = [];
            $kunyeData = [];

            foreach ($posts as $p) {
                $images = MediaTagParser::extractImages($p->content, $baseUrl, $customTags, 'thumb');
                $kData = MediaTagParser::extractKunyeData($p->content);

                if (!empty($images) && empty($allImages)) {
                    $allImages = $images;
                    $matchedPost = $p;
                }
                if (!empty($kData['lines']) || !empty($kData['plate'])) {
                    if (empty($kunyeData['lines'])) {
                        $kunyeData = $kData;
                    }
                    if (!$matchedPost) $matchedPost = $p;
                }

                if (!empty($allImages) && !empty($kunyeData['lines'])) {
                    break;
                }
            }

            if (!$matchedPost) {
                $matchedPost = $discussion->firstPost;
            }

            $firstImgUrl = !empty($allImages) ? $allImages[0]['url'] : null;

            // Eser Sahibi (Fotoğraf Sanatçısı / Yazar) Çözümleme
            $authorName = null;

            // 1. Görselin EXIF Metadata Kaydı (Artist / Copyright)
            if (!empty($allImages[0]['id']) && class_exists('\Framio\UploadExif\Database\FramioImage')) {
                try {
                    $imgRecord = \Framio\UploadExif\Database\FramioImage::find($allImages[0]['id']);
                    if ($imgRecord && !empty($imgRecord->exif_data)) {
                        $exif = is_array($imgRecord->exif_data) ? $imgRecord->exif_data : json_decode($imgRecord->exif_data, true);
                        if (!empty($exif['artist'])) {
                            // Örn: "Ali Kaan KAYA - @alikaangraphy" -> "Ali Kaan KAYA"
                            $parts = explode('-', $exif['artist']);
                            $authorName = trim($parts[0]);
                        } elseif (!empty($exif['copyright'])) {
                            $authorName = trim(str_ireplace(['©', '(c)', 'copyright'], '', $exif['copyright']));
                        }
                    }
                } catch (\Throwable $e) {}
            }

            // 2. Künyede Yazılmış Eser Sahibi / Fotoğrafçı
            if (empty($authorName) && !empty($kunyeData['author'])) {
                $authorName = $kunyeData['author'];
            }

            // 3. Mesajı Gönderen Forum Kullanıcısı
            if (empty($authorName)) {
                $authorName = $matchedPost && $matchedPost->user ? ($matchedPost->user->display_name ?: $matchedPost->user->username) : resolve(\Framio\SeoPack\Support\SeoSettings::class)->defaultAuthor();
            }
            
            $kunyeLines = $kunyeData['lines'] ?? [];
            $plate = $kunyeData['plate'] ?? '';
            $title = $discussion->title;

            $host = parse_url($baseUrl, PHP_URL_HOST) ?: '';
            $postNum = ($matchedPost && $matchedPost->number) ? $matchedPost->number : 1;
            $postLink = "{$host}/d/{$discussion->id}" . ($postNum > 1 ? "/{$postNum}" : "");

            // GD ile 1200x630 TrueType Social Card Üret
            $imageBinary = $this->generateSocialCardImage($title, $kunyeLines, $plate, $authorName, $forumTitle, $postLink, $firstImgUrl);

            $response = new Response();
            $response->getBody()->write($imageBinary);
            return $response
                ->withHeader('Content-Type', 'image/jpeg')
                ->withHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');

        } catch (\Throwable $e) {
            return new Response\EmptyResponse(404);
        }
    }

    protected function getFontPath(string $weight = 'regular'): ?string
    {
        $pkgFont = __DIR__ . '/../resources/fonts/' . ($weight === 'bold' ? 'bold.ttf' : 'regular.ttf');
        if (file_exists($pkgFont)) {
            return realpath($pkgFont);
        }

        $candidates = [
            'bold' => [
                'C:/Windows/Fonts/segoeuib.ttf',
                'C:/Windows/Fonts/arialbd.ttf',
                'C:/Windows/Fonts/tahomabd.ttf',
                '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
                '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
            ],
            'regular' => [
                'C:/Windows/Fonts/segoeui.ttf',
                'C:/Windows/Fonts/arial.ttf',
                'C:/Windows/Fonts/tahoma.ttf',
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
                '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
            ]
        ];

        foreach ($candidates[$weight] ?? $candidates['regular'] as $path) {
            if (file_exists($path)) {
                return $path;
            }
        }

        return null;
    }

    protected function generateSocialCardImage(string $title, array $kunyeLines, string $plate, string $author, string $forumTitle, string $postLink, ?string $imgUrl): string
    {
        $width = 1200;
        $height = 630;

        $image = imagecreatetruecolor($width, $height);
        imagealphablending($image, true);
        imagesavealpha($image, true);

        // Renk Paleti
        $bgDark = imagecolorallocate($image, 15, 20, 31);
        $cardBg = imagecolorallocate($image, 24, 32, 48);
        $accentBlue = imagecolorallocate($image, 56, 189, 248);
        $accentGold = imagecolorallocate($image, 250, 204, 21);
        $accentGreen = imagecolorallocate($image, 52, 211, 153);
        $textWhite = imagecolorallocate($image, 248, 250, 252);
        $textLight = imagecolorallocate($image, 226, 232, 240);
        $textMuted = imagecolorallocate($image, 148, 163, 184);
        
        $kunyeBoxBg = imagecolorallocatealpha($image, 30, 41, 59, 40);
        $kunyeBoxBorder = imagecolorallocate($image, 51, 65, 85);
        $bulletColor = imagecolorallocate($image, 56, 189, 248);
        $linkBadgeBg = imagecolorallocatealpha($image, 15, 23, 42, 30);

        // Ana arka planı doldur
        imagefilledrectangle($image, 0, 0, $width, $height, $bgDark);

        $fontRegular = $this->getFontPath('regular');
        $fontBold = $this->getFontPath('bold');

        $hasPhoto = false;
        if ($imgUrl) {
            $photoResource = $this->fetchImageResource($imgUrl);
            if ($photoResource) {
                $hasPhoto = true;
                $pWidth = imagesx($photoResource);
                $pHeight = imagesy($photoResource);

                // 1. Arka plana ortam parıltısı (Ambient Glow)
                imagecopyresampled($image, $photoResource, 0, 0, 0, 0, $width, $height, $pWidth, $pHeight);

                // Üzerine koyu degrade katman ört
                $overlay = imagecolorallocatealpha($image, 15, 20, 31, 32);
                imagefilledrectangle($image, 0, 0, $width, $height, $overlay);

                // 2. Sol tarafta 710x530 ana fotoğraf kartı
                $targetW = 710;
                $targetH = 530;
                $targetX = 50;
                $targetY = 50;

                // Kart arkalığı
                imagefilledrectangle($image, $targetX - 4, $targetY - 4, $targetX + $targetW + 4, $targetY + $targetH + 4, $cardBg);

                // Fotoğrafı yerleştir
                imagecopyresampled($image, $photoResource, $targetX, $targetY, 0, 0, $targetW, $targetH, $pWidth, $pHeight);
                imagedestroy($photoResource);
            }
        }

        // Sağ panel için şık koyu yarı saydam kart
        $panelX = $hasPhoto ? 785 : 50;
        $panelY = 50;
        $panelW = $hasPhoto ? 365 : 1100;
        $panelH = 530;

        $rightPanelBg = imagecolorallocatealpha($image, 15, 23, 42, 12);
        imagefilledrectangle($image, $panelX, $panelY, $panelX + $panelW, $panelY + $panelH, $rightPanelBg);
        imagerectangle($image, $panelX, $panelY, $panelX + $panelW, $panelY + $panelH, $cardBg);

        $textStartX = $panelX + 24;
        $contentW = $panelW - 48;

        // 1. Üst Başlık (Forum Markası & Doğrudan Mesaj/Konu Bağlantısı)
        $brandHeader = mb_strtoupper($forumTitle, 'UTF-8');
        if ($fontBold) {
            imagettftext($image, 14, 0, $textStartX, 88, $accentBlue, $fontBold, $brandHeader);
        }

        // 2. Konu Başlığı
        $cleanTitle = Str::limit($title, $hasPhoto ? 60 : 120, '...');
        $titleLines = $this->wrapTextForTtf($cleanTitle, $hasPhoto ? 22 : 45, 2);
        $titleStartY = 120;
        foreach ($titleLines as $idx => $line) {
            if ($fontBold) {
                imagettftext($image, 16, 0, $textStartX, $titleStartY + ($idx * 26), $textWhite, $fontBold, $line);
            }
        }

        $nextY = $titleStartY + (count($titleLines) * 26) + 12;

        // 3. Künye Kutusu (3 veya 4 Satırlı Dinamik Künye Kartı)
        if (!empty($kunyeLines)) {
            $lineCount = min(count($kunyeLines), 4);
            $boxHeight = ($lineCount * 38) + 16;
            
            // Künye Kartı Arka Planı
            imagefilledrectangle($image, $textStartX, $nextY, $textStartX + $contentW, $nextY + $boxHeight, $kunyeBoxBg);
            imagerectangle($image, $textStartX, $nextY, $textStartX + $contentW, $nextY + $boxHeight, $kunyeBoxBorder);

            // Künye Satırlarını Çiz
            foreach (array_slice($kunyeLines, 0, 4) as $kIdx => $kLine) {
                $itemY = $nextY + 28 + ($kIdx * 38);
                $cleanKLine = trim(strip_tags($kLine));

                // Madde İmi Çiz (Yuvarlak / Mavi Nokta)
                imagefilledellipse($image, $textStartX + 14, $itemY - 5, 8, 8, $bulletColor);

                // Satır Metni
                $lineColor = ($kIdx === 0) ? $textWhite : (($kIdx === 1) ? $accentGold : $textLight);
                $fontSize = ($kIdx === 0) ? 13 : (($kIdx === 1) ? 12 : 11);
                $fontWeight = ($kIdx === 0 || $kIdx === 1) ? ($fontBold ?: $fontRegular) : $fontRegular;

                $renderedLine = Str::limit($cleanKLine, 32, '..');
                if ($fontWeight) {
                    imagettftext($image, $fontSize, 0, $textStartX + 28, $itemY, $lineColor, $fontWeight, $renderedLine);
                }
            }
        } elseif (!empty($plate)) {
            // Sadece plaka varsa şık rozet çiz
            $pBoxH = 50;
            imagefilledrectangle($image, $textStartX, $nextY, $textStartX + $contentW, $nextY + $pBoxH, $kunyeBoxBg);
            imagerectangle($image, $textStartX, $nextY, $textStartX + $contentW, $nextY + $pBoxH, $kunyeBoxBorder);
            if ($fontBold) {
                imagettftext($image, 16, 0, $textStartX + 18, $nextY + 34, $textWhite, $fontBold, mb_strtoupper($plate, 'UTF-8'));
            }
        }

        // 4. Alt Bölüm: ESER SAHİBİ & Doğrudan Mesaj Bağlantısı & Telif
        $footerY = 472;
        if ($fontRegular) {
            // Eser Sahibi (Fotoğrafı Çeken / Eser Sahibi)
            $authorLabel = "ESER SAHİBİ: " . mb_strtoupper($author, 'UTF-8');
            imagettftext($image, 11, 0, $textStartX, $footerY, $accentGold, $fontBold ?: $fontRegular, Str::limit($authorLabel, 34, '...'));
            
            // Fotoğrafın ve Konunun Doğrudan Bağlantı Rozeti
            $linkText = Str::limit($postLink, 35, '...');
            imagettftext($image, 10, 0, $textStartX, $footerY + 24, $accentBlue, $fontBold ?: $fontRegular, "BAĞLANTI: " . $linkText);

            // Telif & Arşiv
            imagettftext($image, 10, 0, $textStartX, $footerY + 46, $textMuted, $fontRegular, "© " . date('Y') . " " . $forumTitle . " • Orijinal Medya");
        }

        // Çıktı tamponu
        ob_start();
        imagejpeg($image, null, 90);
        $output = ob_get_clean();
        imagedestroy($image);

        return $output;
    }

    protected function fetchImageResource(string $url)
    {
        try {
            $opts = [
                'http' => [
                    'method' => 'GET',
                    'timeout' => 3,
                    'user_agent' => 'FramioSeoBot/1.0'
                ]
            ];
            $context = stream_context_create($opts);
            $data = @file_get_contents($url, false, $context);
            if (!$data) return null;

            return @imagecreatefromstring($data);
        } catch (\Throwable $e) {
            return null;
        }
    }

    protected function wrapTextForTtf(string $text, int $maxChars, int $maxLines): array
    {
        $words = explode(' ', $text);
        $lines = [];
        $current = '';

        foreach ($words as $word) {
            if (mb_strlen($current . ' ' . $word, 'UTF-8') <= $maxChars) {
                $current = empty($current) ? $word : $current . ' ' . $word;
            } else {
                if (!empty($current)) $lines[] = $current;
                $current = $word;
                if (count($lines) >= $maxLines - 1) break;
            }
        }
        if (!empty($current) && count($lines) < $maxLines) {
            $lines[] = $current;
        }

        return $lines;
    }
}
