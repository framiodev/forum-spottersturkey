<?php

namespace Framio\UploadExif\Helpers;

use Illuminate\Support\Str;

class MediaTagParser
{
    /**
     * Varsayılan tanınan BBCode etiket isimleri
     */
    protected static array $defaultTags = [
        'framio-image',
        'spotter-image',
        'ulasimarsiv-image',
        'upl-image-preview',
        'spotter-gallery',
        'framio-gallery'
    ];

    /**
     * Tanımlı/özelleştirilmiş etiket listesini döndürür.
     * 
     * @param string|array|null $customTags Admin panelinden gelen özel etiketler (virgülle ayrılmış veya dizi)
     * @return array
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
     * 
     * @param string $content Gönderi ham metni veya HTML içeriği
     * @param string $baseUrl Forum kök adresi
     * @param string|array|null $customTags Ekstra tanınacak etiketler
     * @param string $preferredQuality 'original' | 'thumb' | 'mini'
     * @return array Görsel dizisi: [['id' => ..., 'url' => ..., 'alt' => ..., 'tag' => ..., 'raw' => ...]]
     */
    public static function extractImages(string $content, string $baseUrl = '', $customTags = null, string $preferredQuality = 'thumb'): array
    {
        $foundImages = [];
        $tags = self::getRecognizedTags($customTags);
        $tagsPattern = implode('|', array_map('preg_quote', $tags));

        // 1. Özel BBCode Etiketlerini Tara ([framio-image ...], [spotter-image ...], [ulasimarsiv-image ...] vb.)
        if (preg_match_all('/\\[(?:' . $tagsPattern . ')(?:\\s[^\\]]*)?\\]/is', $content, $matches)) {
            foreach ($matches[0] as $rawTag) {
                $id = null;
                $url = null;
                $alt = '';

                // ID yakalama (id="123", id='123', id=123)
                if (preg_match('/id=["\']?(\\d+)["\']?/i', $rawTag, $m)) {
                    $id = (int)$m[1];
                }

                // URL yakalama (url="https://...", url='https://...', url=https://...)
                if (preg_match('/url=["\']?(http[^"\'\\]\\s]+)["\']?/i', $rawTag, $m)) {
                    $url = $m[1];
                } elseif (preg_match('/url=([^"\'\\]\\s]+)/i', $rawTag, $m)) {
                    $url = $m[1];
                }

                // Alt metni yakalama (alt="...", alt='...', alt=...)
                if (preg_match('/alt="([^"]*)"/i', $rawTag, $m)) {
                    $alt = $m[1];
                } elseif (preg_match('/alt=\'([^\']*)\'/i', $rawTag, $m)) {
                    $alt = $m[1];
                } elseif (preg_match('/alt=([^\\]\\s]+)/i', $rawTag, $m)) {
                    $alt = trim(trim($m[1], '"\''));
                }

                // Etiket adını tespit et
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

        // 4. HTML <img src="..."> Tara (Eğer henüz bulunamadıysa veya HTML içerikse)
        if (preg_match_all('/<img[^>]+src=["\']([^"\']+)["\'][^>]*>/i', $content, $matches)) {
            foreach ($matches[1] as $index => $rawUrl) {
                $rawUrl = trim($rawUrl);
                $url = $rawUrl;

                if (!Str::startsWith($url, ['http://', 'https://', '//'])) {
                    $url = rtrim($baseUrl, '/') . '/' . ltrim($url, '/');
                }

                // Alt etiketini al
                $alt = '';
                if (preg_match('/alt=["\']([^"\']*)["\']/i', $matches[0][$index], $altM)) {
                    $alt = $altM[1];
                }

                // Aynı URL zaten listelenmediyse ekle
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

        return $foundImages;
    }

    /**
     * Görsel kalitesini/boyutunu URL'ye göre optimize eder.
     */
    public static function formatImageQuality(string $url, string $quality = 'thumb'): string
    {
        $url = trim($url);

        if ($quality === 'original') {
            // thumb_ veya mini_ öneklerini kaldırıp orijinal 4K / tam boyuta çevir
            return preg_replace('/(\/)(?:thumb_|mini_)/i', '$1', $url);
        }

        if ($quality === 'thumb') {
            // Eğer URL'de thumb_ yoksa ve dosya adı geliyorsa thumb_ eklenebilir veya mevcut bırakılır
            return $url;
        }

        return $url;
    }

    /**
     * Gönderi içindeki belirli bir BBCode etiketini diğerine dönüştürür (Toplu Migration / Etiket Değiştirme için).
     * 
     * @param string $content
     * @param string $fromTag Örn: 'spotter-image' veya 'ulasimarsiv-image'
     * @param string $toTag Örn: 'framio-image'
     * @return string
     */
    public static function migrateTag(string $content, string $fromTag, string $toTag): string
    {
        if (empty($fromTag) || empty($toTag) || $fromTag === $toTag) {
            return $content;
        }

        return preg_replace(
            '/\\[\\s*' . preg_quote($fromTag, '/') . '(\\s[^\\]]*)?\\]/i',
            '[' . $toTag . '$1]',
            $content
        );
    }
}
