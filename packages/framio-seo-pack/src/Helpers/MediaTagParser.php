<?php

namespace Framio\SeoPack\Helpers;

use Illuminate\Support\Str;

class MediaTagParser
{
    /**
     * Framio Upload & EXIF ve FoF Upload'ın kendi etiketleri. Siteye özel
     * etiketler (eski sürümlerden kalanlar dahil) admin panelindeki
     * "Tanınan BBCode etiketleri" ayarıyla eklenir.
     */
    protected static array $defaultTags = [
        'framio-image',
        'framio-gallery',
        'upl-image-preview',
    ];

    /**
     * Künye satırlarında aranacak varsayılan marka listesi; admin panelindeki
     * "Bilinen markalar" ayarı doluysa onun yerine o kullanılır.
     */
    public const DEFAULT_BRANDS = [
        'Mercedes-Benz', 'Mercedes', 'Setra', 'MAN', 'Neoplan', 'Temsa', 'Otokar', 'Isuzu', 'BMC',
        'Scania', 'Volvo', 'Iveco', 'Karsan', 'Güleryüz', 'Akia', 'Solaris', 'Van Hool', 'DAF',
        'Renault', 'Ford', 'Boeing', 'Airbus', 'Bombardier', 'Embraer', 'Siemens', 'Alstom', 'Stadler',
    ];

    /**
     * Tanımlı/özelleştirilmiş etiket listesini döndürür.
     */
    public static function getRecognizedTags($customTags = null): array
    {
        $tags = self::$defaultTags;

        if (!empty($customTags)) {
            if (is_string($customTags)) {
                $customTags = array_map('trim', explode(',', $customTags));
            }
            if (is_array($customTags)) {
                $tags = array_values(array_unique(array_merge($tags, array_filter($customTags))));
            }
        }

        return $tags;
    }

    /**
     * Bir metin/gönderi içeriğindeki tüm medya görsellerini ayıklar.
     */
    public static function extractImages(string $content, string $baseUrl = '', $customTags = null, string $preferredQuality = 'thumb'): array
    {
        $foundImages = [];
        $tags = self::getRecognizedTags($customTags);
        $tagsPattern = implode('|', array_map('preg_quote', $tags));

        // 1. Özel BBCode Etiketlerini Tara (framio-image ve ayarlardaki ek etiketler)
        if (preg_match_all('/\\[(?:' . $tagsPattern . ')(?:\\s[^\\]]*)?\\]/is', $content, $matches)) {
            foreach ($matches[0] as $rawTag) {
                $id = null;
                $url = null;
                $alt = '';

                // ID yakalama
                if (preg_match('/id=["\']?(\\d+)["\']?/i', $rawTag, $m)) {
                    $id = (int)$m[1];
                }

                // URL yakalama (tırnaklı değer boşluk içerebilir)
                if (preg_match('/url="([^"]+)"/i', $rawTag, $m) || preg_match("/url='([^']+)'/i", $rawTag, $m)) {
                    $url = trim($m[1]);
                } elseif (preg_match('/url=["\']?(http[^"\'\\]\\s]+)["\']?/i', $rawTag, $m)) {
                    $url = $m[1];
                } elseif (preg_match('/url=([^"\'\\]\\s]+)/i', $rawTag, $m)) {
                    $url = $m[1];
                }

                // Alt metni yakalama
                if (preg_match('/alt="([^"]*)"/i', $rawTag, $m)) {
                    $alt = $m[1];
                } elseif (preg_match('/alt=\'([^\']*)\'/i', $rawTag, $m)) {
                    $alt = $m[1];
                } elseif (preg_match('/alt=([^\\]\\s]+)/i', $rawTag, $m)) {
                    $alt = trim(trim($m[1], '"\''));
                }

                preg_match('/^\\[([a-zA-Z0-9_-]+)/', $rawTag, $tagMatch);
                $tagName = $tagMatch[1] ?? 'framio-image';

                if ($url) {
                    $normalizedUrl = self::formatImageQuality($url, $preferredQuality);
                    $foundImages[] = [
                        'id' => $id,
                        'url' => $normalizedUrl,
                        'original_url' => self::formatImageQuality($url, 'original'),
                        'thumb_url' => self::formatImageQuality($url, 'thumb'),
                        'alt' => $alt,
                        'tag' => $tagName,
                        'raw' => $rawTag,
                        'type' => 'bbcode'
                    ];
                }
            }
        }

        // 1.1 Flarum XML Formatlı Medya Etiketlerini Tara (<FRAMIO-IMAGE ...> vb.)
        if (preg_match_all('/<(?:' . $tagsPattern . ')(?:\\s[^>]*?)>/is', $content, $xmlMatches)) {
            foreach ($xmlMatches[0] as $rawXmlTag) {
                $id = null;
                $url = null;
                $alt = '';

                if (preg_match('/id=["\']?(\\d+)["\']?/i', $rawXmlTag, $m)) {
                    $id = (int)$m[1];
                }
                if (preg_match('/url="([^"]+)"/i', $rawXmlTag, $m) || preg_match("/url='([^']+)'/i", $rawXmlTag, $m)) {
                    $url = trim($m[1]);
                } elseif (preg_match('/url=(http[^"\'>\\s]+)/i', $rawXmlTag, $m)) {
                    $url = $m[1];
                }
                if (preg_match('/alt="([^"]*)"/i', $rawXmlTag, $m) || preg_match("/alt='([^']*)'/i", $rawXmlTag, $m)) {
                    $alt = $m[1];
                }

                preg_match('/^<([a-zA-Z0-9_-]+)/', $rawXmlTag, $xmlTagMatch);
                $tagName = strtolower($xmlTagMatch[1] ?? 'framio-image');

                if ($url && !collect($foundImages)->contains('url', $url)) {
                    $normalizedUrl = self::formatImageQuality($url, $preferredQuality);
                    $foundImages[] = [
                        'id' => $id,
                        'url' => $normalizedUrl,
                        'original_url' => self::formatImageQuality($url, 'original'),
                        'thumb_url' => self::formatImageQuality($url, 'thumb'),
                        'alt' => $alt,
                        'tag' => $tagName,
                        'raw' => $rawXmlTag,
                        'type' => 'xml'
                    ];
                }
            }
        }

        // 2. Standart Markdown Görsellerini Tara (![alt](url))
        if (preg_match_all('/!\\[([^\\]]*)\\]\\(([^\\)]+)\\)/is', $content, $matches)) {
            foreach ($matches[2] as $index => $rawUrl) {
                $rawUrl = trim($rawUrl);
                $alt = $matches[1][$index] ?? '';
                $url = $rawUrl;

                if (!Str::startsWith($url, ['http://', 'https://', '//'])) {
                    $url = rtrim($baseUrl, '/') . '/' . ltrim($url, '/');
                }

                $foundImages[] = [
                    'id' => null,
                    'url' => $url,
                    'original_url' => $url,
                    'thumb_url' => $url,
                    'alt' => $alt,
                    'tag' => 'markdown',
                    'raw' => $matches[0][$index],
                    'type' => 'markdown'
                ];
            }
        }

        // 3. Standart BBCode [img]url[/img] Tara
        if (preg_match_all('/\\[img\\](.*?)\\[\\/img\\]/is', $content, $matches)) {
            foreach ($matches[1] as $index => $rawUrl) {
                $rawUrl = trim($rawUrl);
                $url = $rawUrl;

                if (!Str::startsWith($url, ['http://', 'https://', '//'])) {
                    $url = rtrim($baseUrl, '/') . '/' . ltrim($url, '/');
                }

                $foundImages[] = [
                    'id' => null,
                    'url' => $url,
                    'original_url' => $url,
                    'thumb_url' => $url,
                    'alt' => '',
                    'tag' => 'img',
                    'raw' => $matches[0][$index],
                    'type' => 'bbcode_img'
                ];
            }
        }

        // 4. HTML <img src="..."> Tara
        if (preg_match_all('/<img[^>]+src=["\']([^"\']+)["\'][^>]*>/i', $content, $matches)) {
            foreach ($matches[1] as $index => $rawUrl) {
                $rawUrl = trim($rawUrl);
                $url = $rawUrl;

                if (!Str::startsWith($url, ['http://', 'https://', '//'])) {
                    $url = rtrim($baseUrl, '/') . '/' . ltrim($url, '/');
                }

                $alt = '';
                if (preg_match('/alt=["\']([^"\']*)["\']/i', $matches[0][$index], $altM)) {
                    $alt = $altM[1];
                }

                if (!collect($foundImages)->contains('url', $url)) {
                    $foundImages[] = [
                        'id' => null,
                        'url' => $url,
                        'original_url' => $url,
                        'thumb_url' => $url,
                        'alt' => $alt,
                        'tag' => 'html_img',
                        'raw' => $matches[0][$index],
                        'type' => 'html'
                    ];
                }
            }
        }

        // Adresleri normalleştir: kayıtlı XML'den kalan işaretler (<s>[img]</s>…<e>), HTML kaçışları ve
        // yanlış kök yol (/public/assets → /assets). Bozuk kalan adresler atılır.
        $seen = [];
        $clean = [];
        foreach ($foundImages as $img) {
            foreach (['url', 'original_url', 'thumb_url'] as $k) {
                if (isset($img[$k])) $img[$k] = self::normalizeUrl((string) $img[$k], $baseUrl);
            }
            if ($img['url'] === '' || !preg_match('~^(https?:)?//[^\s<>"]+$~i', $img['url']) || isset($seen[$img['url']])) continue;
            $seen[$img['url']] = true;
            $clean[] = $img;
        }

        return $clean;
    }

    /** Görsel adresini temizler (bkz. extractImages sonu). */
    public static function normalizeUrl(string $url, string $baseUrl = ''): string
    {
        $url = trim(html_entity_decode(strip_tags($url), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        // [img] etiketinin metin içinde kalan parçaları
        $url = trim(preg_replace('~\[/?img\]~i', '', $url));
        if (preg_match('~(https?://\S+)~i', $url, $m) && !str_starts_with($url, 'http')) {
            $url = $m[1];
        }
        // Forum kökü dışındaki "public" klasörü adreslere sızmışsa düzelt
        $url = preg_replace('~^(https?://[^/]+)/public/assets/~i', '$1/assets/', $url);

        return $url;
    }

    /**
     * Görsel kalitesini/boyutunu URL'ye göre optimize eder.
     */

    /**
     * CDN görsel URL'ini forum alan adındaki proxy URL'ine dönüştürür.
     * Kurallar admin panelindeki "Görsel proxy kuralları" ayarından gelir
     * (host => yol öneki). Örnek kural "cdn.example.com|/assets/site/" ile:
     *   https://cdn.example.com/assets/site/2026/04/foto.jpg
     *   → https://forum.example.com/f/2026/04/foto.jpg
     * Kural yoksa veya host eşleşmiyorsa URL olduğu gibi (boşlukları
     * kodlanmış olarak) döner. Proxy'nin kendisi sunucu tarafında
     * (ör. .htaccess) tanımlanmalıdır.
     *
     * @param array<string,string> $rules
     */
    public static function toProxyUrl(string $url, string $forumBaseUrl, string $quality = 'original', array $rules = [], string $proxyPath = '/f/'): string
    {
        $url = self::formatImageQuality(trim($url), $quality);
        $parsed = parse_url($url);
        $host = strtolower($parsed['host'] ?? '');
        $path = $parsed['path'] ?? '';

        if ($host === '' || !array_key_exists($host, $rules)) {
            return self::encodeUrl($url);
        }

        $prefix = $rules[$host];
        $relPath = ($prefix !== '' && str_starts_with($path, $prefix)) ? substr($path, strlen($prefix)) : ltrim($path, '/');
        $proxyPath = '/' . trim($proxyPath, '/') . '/';

        return self::encodeUrl(rtrim($forumBaseUrl, '/') . $proxyPath . ltrim($relPath, '/'));
    }

    /** Dosya adlarındaki boşluk gibi karakterleri URL için güvenli hale getirir. */
    public static function encodeUrl(string $url): string
    {
        return str_replace([' ', '"', '<', '>'], ['%20', '%22', '%3C', '%3E'], $url);
    }
    public static function formatImageQuality(string $url, string $quality = 'thumb'): string
    {
        $url = trim($url);

        if ($quality === 'original') {
            // thumb_/mini_ kopyaları ve görsel sunucusunun ?w= boyut parametresi yerine tam boyutlu görsel
            $url = preg_replace('/(\/)(?:thumb_|mini_)/i', '$1', $url);

            return preg_replace('/[?&]w=\d+(?=&|$)/', '', $url);
        }

        return $url;
    }

    /**
     * Görsel bazında künye: mesajı baştan sona tarar; her künye bloğu,
     * kendinden önceki ve henüz künyesi olmayan görsellere atanır.
     *   Tek açıklama     : [görsel][görsel][görsel][künye]   → üçü aynı künye
     *   Birden çok açık. : [görsel][künye][görsel][künye]   → her biri kendi künyesi
     * Künyesi olmayan (sondaki) görseller, mesajdaki ilk künyeyi alır.
     *
     * @param string $content Ham (entity'leri çözülmüş) XML veya kaynak metin
     * @return array<int,array{image:array,kunye:array}> görsel sırasıyla
     */
    public static function imagesWithKunye(string $content, string $baseUrl = '', $customTags = null, string $quality = 'thumb', array $knownBrands = []): array
    {
        $tags = self::getRecognizedTags($customTags);
        $tagPattern = implode('|', array_map(fn ($t) => preg_quote(strtoupper($t), '/'), $tags));

        // Sırayla: medya öğesi | framio-kunye bloğu | (eski biçim) kalın satırlı liste
        $pattern = '/(?<media><(?:' . $tagPattern . ')\b[^>]*>.*?<\/(?:' . $tagPattern . ')>)'
            . '|(?<kunye><FRAMIO-KUNYE\b[^>]*>.*?<\/FRAMIO-KUNYE>)'
            . '|(?<list><LIST>(?:(?!<\/LIST>).)*?<STRONG>.*?<\/LIST>)/is';

        if (!preg_match_all($pattern, $content, $m, PREG_SET_ORDER)) {
            return [];
        }

        $result = [];
        $pending = [];
        $firstKunye = null;

        foreach ($m as $token) {
            if (!empty($token['media'])) {
                foreach (self::extractImages($token['media'], $baseUrl, $customTags, $quality) as $img) {
                    if (in_array($img['type'] ?? '', ['bbcode', 'xml'], true)) {
                        $pending[] = $img;
                    }
                }
                continue;
            }

            $block = !empty($token['kunye']) ? $token['kunye'] : ($token['list'] ?? '');
            $kunye = self::extractKunyeData($block, $knownBrands);
            if (empty($kunye['lines'])) {
                continue;
            }
            $firstKunye ??= $kunye;
            foreach ($pending as $img) {
                $result[] = ['image' => $img, 'kunye' => $kunye];
            }
            $pending = [];
        }

        foreach ($pending as $img) {
            $result[] = ['image' => $img, 'kunye' => $firstKunye ?? self::extractKunyeData('', $knownBrands)];
        }

        // Aynı görsel (XML + iç BBCode) iki kez sayılmasın; "a b.jpg" ile
        // "a%20b.jpg" aynı dosyadır
        $seen = [];

        $result = array_values(array_filter($result, function ($r) use (&$seen) {
            $key = rawurldecode(html_entity_decode($r['image']['url'], ENT_QUOTES));
            if (isset($seen[$key])) {
                return false;
            }

            return $seen[$key] = true;
        }));

        // Fotoğrafa özel Info ("📷 Fotoğraf 2, 3 · Meraklısına Info") → o görseller
        $info = self::extractInfo($content);
        foreach ($result as $i => &$r) {
            $r['info'] = $info['photos'][$i + 1] ?? '';
        }
        unset($r);

        return $result;
    }

    /**
     * Mesajdaki Info (Meraklısına Info / T R I V I A) alıntı blokları.
     * Başlığında "📷 Fotoğraf N, M" olan blok yalnızca o fotoğraflara (1'den
     * başlayan sıra) aittir; diğerleri mesajın geneline aittir.
     *
     * @return array{post: string, photos: array<int, string>}
     */
    public static function extractInfo(string $content): array
    {
        $out = ['post' => '', 'photos' => []];
        if (!preg_match_all('/<QUOTE\b[^>]*>(.*?)<\/QUOTE>/is', $content, $m)) {
            return $out;
        }

        foreach ($m[1] as $block) {
            // Biçim işaretleri (<s>**</s> vb.) atılır; etiket sınırları boşluk olur
            $clean = preg_replace(['/<(s|e|i)>.*?<\/\1>/is', '/<[^>]+>/'], ['', ' '], $block);
            $text = trim(preg_replace('/\s+/u', ' ', html_entity_decode($clean, ENT_QUOTES | ENT_XML1, 'UTF-8')));
            if (!preg_match('/Merakl[ıi]s[ıi]na\s*Info|T\s*R\s*[İI]\s*V\s*[İI]\s*A/iu', $text)) {
                continue;
            }

            if (preg_match('/📷\s*Fotoğraf\s*([\d,\s]+)/u', $text, $pm)) {
                $body = trim(preg_replace('/^.*?Merakl[ıi]s[ıi]na\s*Info\s*/iu', '', $text));
                foreach (array_filter(array_map('intval', preg_split('/[,\s]+/', $pm[1]))) as $n) {
                    $out['photos'][$n] = trim(($out['photos'][$n] ?? '') . ' ' . $body);
                }
                continue;
            }

            $body = trim(preg_replace(['/^.*?Merakl[ıi]s[ıi]na\s*Info\s*/iu', '/^\s*T\s*R\s*[İI]\s*V\s*[İI]\s*A\s*/iu'], '', $text));
            $out['post'] = trim($out['post'] . ' ' . $body);
        }

        return $out;
    }

    /**
     * Gönderi içeriğinden künye başlığını, plakasını, markasını ve modelini akıllıca ayıklar.
     */
    public static function extractKunyeData(string $content, array $knownBrands = []): array
    {
        $knownBrands = $knownBrands ?: self::DEFAULT_BRANDS;
        // Uzun adlar önce denensin ("Mercedes-Benz" → "Mercedes"den önce)
        usort($knownBrands, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));

        // Flarum'un ayrıştırılmış XML'i "- **x**" satırlarını etiketlerle böler
        // (<s>- </s><STRONG><s>**</s>x<e>**</e></STRONG>); önce etiketleri ayıkla.
        // Medya etiketlerinin içindeki kaynak BBCode ([… alt="…"]) künye değildir.
        if (str_contains($content, '<')) {
            $content = preg_replace('/<([A-Z][A-Z0-9_-]*-(?:IMAGE|PREVIEW|GALLERY))\b[^>]*>.*?<\/\1>/s', ' ', $content);
            $content = html_entity_decode(strip_tags(str_replace(['<br/>', '<br>', '</LI>', '</p>'], "\n", $content)), ENT_QUOTES | ENT_XML1, 'UTF-8');
        }

        $lines = [];
        // [framio-kunye]...[/framio-kunye] veya - **...** yapılarını tara
        if (preg_match('/\[framio-kunye[^\]]*\](.*?)\[\/framio-kunye\]/is', $content, $kM)) {
            $inner = trim($kM[1]);
            preg_match_all('/-\s*\*\*(.*?)\*\*/s', $inner, $m);
            if (!empty($m[1])) {
                $lines = array_map('trim', $m[1]);
            }
        }

        if (empty($lines)) {
            preg_match_all('/-\s*\*\*(.*?)\*\*/s', $content, $m);
            if (!empty($m[1])) {
                $lines = array_map('trim', $m[1]);
            }
        }

        $plate = '';
        $company = '';
        $brand = '';
        $model = '';
        $location = '';
        $route = '';

        // 1. Satır Analizi (Örn: "Varan | 34 CDL 37", "Mercedes-Benz Tourismo 16 RHD", "Ankara / '26")
        foreach ($lines as $line) {
            $cleanLine = trim(strip_tags($line));

            // Plaka tespiti (TR Plaka veya Havacılık Tescil)
            if (preg_match('/\b(0[1-9]|[1-7][0-9]|8[01])\s*([A-Z]{1,3})\s*([0-9]{2,4})\b/u', $cleanLine, $pM)) {
                $plate = trim($pM[0]);
                // Eğer "Varan | 34 CDL 37" formatındaysa firma adını da al
                if (strpos($cleanLine, '|') !== false) {
                    $parts = explode('|', $cleanLine);
                    $company = trim($parts[0]);
                }
            } elseif (preg_match('/\b(TC-[A-Z]{3})\b/u', $cleanLine, $pM)) {
                $plate = trim($pM[0]);
                if (strpos($cleanLine, '|') !== false) {
                    $parts = explode('|', $cleanLine);
                    $company = trim($parts[0]);
                }
            }

            // Şehiriçi hat satırı: "73F | Florya - Taksim", "559C | Şaşkınbakkal - Taksim" (plaka içermeyen)
            if (!$route && !preg_match('/\b(0[1-9]|[1-7][0-9]|8[01])\s*[A-Z]{1,3}\s*[0-9]{2,4}\b/u', $cleanLine)
                && preg_match('/^([0-9A-ZÇĞİÖŞÜ][0-9A-ZÇĞİÖŞÜa-zçğıöşü\-]{0,7})\s*\|\s*(.+\s[-–]\s.+)$/u', $cleanLine)) {
                $route = $cleanLine;
            }

            // Araç Marka / Model Tespiti
            foreach ($knownBrands as $kb) {
                if (!$brand && preg_match('/(?<![\p{L}\p{N}])' . preg_quote($kb, '/') . '(?![\p{L}\p{N}])/iu', $cleanLine, $bm)) {
                    // Künyede yazıldığı haliyle ("TEMSA", "Mercedes-Benz"): bağlantılar metinle birebir eşleşsin
                    $brand = $bm[0];
                    $model = trim(str_ireplace($kb, '', $cleanLine));
                    break;
                }
            }

            // Şehir / Konum tespiti (Örn: Ankara / '26)
            if (preg_match('/[A-Za-zğüşıöçĞÜŞİÖÇ\s]+\s*\/\s*[\'’0-9]+/u', $cleanLine)) {
                $location = $cleanLine;
            }

            // Eser Sahibi / Fotoğrafçı tespiti (Örn: "Fotoğraf: Ali Kaan KAYA", "Eser Sahibi: Ali Kaan KAYA")
            if (preg_match('/(?:Fotoğraf|Eser Sahibi|Spotter|Çeken|Yazar|Foto)\s*:\s*([^,\n\r]+)/iu', $cleanLine, $aM)) {
                $author = trim($aM[1]);
            }
        }

        // Eğer satırlarda bulunamadıysa metin geneline regex uygula
        if (empty($plate)) {
            if (preg_match('/\b(0[1-9]|[1-7][0-9]|8[01])\s*([A-Z]{1,3})\s*([0-9]{2,4})\b/u', $content, $pM)) {
                $plate = trim($pM[0]);
            } elseif (preg_match('/\b(TC-[A-Z]{3})\b/u', $content, $pM)) {
                $plate = trim($pM[0]);
            }
        }

        if (empty($author)) {
            if (preg_match('/(?:Fotoğraf|Eser Sahibi|Spotter|Çeken|Foto)\s*:\s*([^\n\r<]+)/iu', $content, $aM)) {
                $author = trim(strip_tags($aM[1]));
            }
        }

        $title = !empty($lines) ? implode(' - ', array_slice($lines, 0, 2)) : '';
        $full = implode("\n", $lines);

        return [
            'lines' => $lines,
            'title' => $title,
            'full' => $full,
            'plate' => $plate,
            'registration' => $plate,
            'company' => $company,
            'operator' => $company,
            'brand' => $brand,
            'model' => $model,
            'location' => $location,
            'route' => $route,
            'author' => $author ?? null,
            'artist' => $author ?? null,
        ];
    }
}
