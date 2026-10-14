<?php

namespace Framio\SeoPack\Support;

use Flarum\Post\CommentPost;
use Framio\SeoPack\Helpers\MediaTagParser;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Str;

/**
 * Tanınan medya etiketlerinin alt metnini künye bilgisinden (veya dosya
 * adı + tartışma başlığından) üretir. Hem ayrıştırılmış XML özniteliğini
 * hem de içindeki kaynak BBCode'u günceller; böylece mesaj sonradan
 * düzenlendiğinde eski alt metin geri gelmez.
 */
class AltTextFixer
{
    public function __construct(protected SeoSettings $seo, protected ConnectionInterface $db)
    {
    }

    /**
     * @param bool $overwrite false: yalnızca boş alt metinleri doldurur.
     * @return bool içerik değişti mi
     */
    public function fix(CommentPost $post, bool $overwrite = false): bool
    {
        $xml = (string) $post->getRawOriginal('content');
        $tags = array_unique(array_merge(['framio-image', 'upl-image-preview'], $this->seo->recognizedTags()));
        $pattern = implode('|', array_map(fn ($t) => preg_quote(strtoupper($t), '/'), $tags));

        if ($xml === '' || !preg_match('/<(' . $pattern . ')[\s>]/i', $xml)) {
            return false;
        }

        $source = html_entity_decode($xml, ENT_QUOTES | ENT_XML1, 'UTF-8');
        $postKunye = MediaTagParser::extractKunyeData($source, $this->seo->knownBrands());
        $title = (string) ($post->discussion->title ?? '');
        $changed = false;

        // Görsel bazında künye (çoklu açıklama): görsel adresi → kendi künyesi
        $byUrl = [];
        foreach (MediaTagParser::imagesWithKunye($source, $this->seo->baseUrl(), $tags, 'thumb', $this->seo->knownBrands()) as $s) {
            $byUrl[$s['image']['url']] = $s['kunye'];
        }

        $new = preg_replace_callback(
            '/<(' . $pattern . ')(\s[^>]*)?>(.*?)<\/\1>/is',
            function ($m) use ($postKunye, $byUrl, $title, $overwrite, &$changed) {
                [$whole, $tag, $attrs, $inner] = [$m[0], $m[1], $m[2] ?? '', $m[3]];

                $current = preg_match('/\balt="([^"]*)"/i', $attrs, $a) ? trim(html_entity_decode($a[1], ENT_QUOTES | ENT_XML1)) : '';
                if ($current !== '' && !$overwrite) {
                    return $whole;
                }

                $url = preg_match('/\burl="([^"]*)"/i', $attrs, $u) ? html_entity_decode($u[1], ENT_QUOTES | ENT_XML1) : '';
                $alt = $this->buildAlt($byUrl[trim($url)] ?? $postKunye, $title, $url);
                if ($alt === '' || $alt === $current) {
                    return $whole;
                }

                $xmlAlt = htmlspecialchars($alt, ENT_XML1 | ENT_COMPAT, 'UTF-8');
                $attrs = preg_match('/\balt="/i', $attrs)
                    ? preg_replace('/\balt="[^"]*"/i', 'alt="' . $xmlAlt . '"', $attrs)
                    : $attrs . ' alt="' . $xmlAlt . '"';

                // Kaynak BBCode ([etiket … alt="…"]) — XML içinde metin olarak durur
                $inner = preg_match('/\balt=(&quot;|")[^"&]*(&quot;|")/i', $inner)
                    ? preg_replace('/\balt=(&quot;|")[^"&]*(&quot;|")/i', 'alt=&quot;' . $xmlAlt . '&quot;', $inner)
                    : preg_replace('/\]\s*$/', ' alt=&quot;' . $xmlAlt . '&quot;]', $inner, 1);

                $changed = true;

                return '<' . $tag . $attrs . '>' . $inner . '</' . $tag . '>';
            },
            $xml
        );

        if ($changed && $new !== null && $new !== $xml) {
            $this->db->table($post->getTable())->where('id', $post->id)->update(['content' => $new]);
            $post->setRawAttributes(array_merge($post->getAttributes(), ['content' => $new]), true);

            return true;
        }

        return false;
    }

    private function buildAlt(array $kunye, string $title, string $url): string
    {
        $filename = $url ? pathinfo((string) parse_url($url, PHP_URL_PATH), PATHINFO_FILENAME) : '';
        $filename = trim(preg_replace('/^(thumb_|mini_)?\d{9,}_?/', '', rawurldecode($filename)));
        $filename = ucwords(str_replace(['-', '_'], ' ', $filename));

        $alt = SeoSettings::fill($this->seo->get('alt_text_format'), [
            'kunye' => $kunye['title'] ?? '',
            'plate' => $kunye['plate'] ?? '',
            'brand' => $kunye['brand'] ?? '',
            'model' => $kunye['model'] ?? '',
            'company' => $kunye['company'] ?? '',
            'title' => $title,
            'filename' => $filename,
            'site_name' => $this->seo->siteName(),
        ]);

        if ($alt === '') {
            $alt = SeoSettings::fill('{filename} - {title}', ['filename' => $filename, 'title' => $title]);
        }

        $alt = str_replace(['"', '[', ']', '{TEXT?}', '**'], '', $alt);

        return Str::limit(trim(preg_replace('/\s+/u', ' ', $alt)), 125, '');
    }
}
