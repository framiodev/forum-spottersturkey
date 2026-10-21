<?php

namespace Framio\UploadExif\Helpers;

use Flarum\Post\CommentPost;

/**
 * Görsel alt metni künyeyle eşitlenir. Yüklemedeki kural (UploadButton.finishProcess) ile aynı:
 * künyenin ilk iki kalın satırı "Firma | Plaka - Marka Model".
 * Çoklu açıklamada her görsel kendisinden sonraki (bir sonraki görsele kadar) künyeyi, yoksa gönderinin ilk künyesini kullanır.
 * Künye düzenlenince (Revised) ve geriye dönük komutla (media:sync-alt) uygulanır.
 */
class AltSync
{
    protected const TAG = '/\[(framio-image|ulasimarsiv-image|spotter-image)\b[^\]]*\]/i';

    public static function altFrom(string $text): string
    {
        // Künye bloğu varsa yalnızca onun içi; yoksa liste satırlarının kalın kısımları
        if (preg_match('/\[framio-kunye[^\]]*\](.*?)\[\/framio-kunye\]/is', $text, $m)) $text = $m[1];
        elseif (!preg_match('/^\s*[-*+]\s+\*\*/m', $text)) return '';
        preg_match_all('/\*\*(.*?)\*\*/s', $text, $mm);
        $parts = array_values(array_filter(array_map('trim', $mm[1])));

        return implode(' - ', array_slice($parts, 0, 2));
    }

    public static function rewrite(string $content): string
    {
        if (!preg_match_all(self::TAG, $content, $tags, PREG_OFFSET_CAPTURE)) return $content;
        $global = self::altFrom($content);
        $out = '';
        $pos = 0;
        $count = count($tags[0]);
        for ($i = 0; $i < $count; $i++) {
            [$tag, $start] = $tags[0][$i];
            $end = $start + strlen($tag);
            $next = $i + 1 < $count ? $tags[0][$i + 1][1] : strlen($content);
            $local = self::altFrom(substr($content, $end, $next - $end));
            $alt = $local !== '' ? $local : $global;
            $newTag = $tag;
            if ($alt !== '') {
                $safe = str_replace(['"', '[', ']'], ['&quot;', '', ''], $alt);
                $newTag = preg_match('/\balt="[^"]*"/i', $tag)
                    ? preg_replace('/\balt="[^"]*"/i', 'alt="' . addcslashes($safe, '\\$') . '"', $tag, 1)
                    : substr($tag, 0, -1) . ' alt="' . $safe . '"]';
            }
            $out .= substr($content, $pos, $start - $pos) . $newTag;
            $pos = $end;
        }

        return $out . substr($content, $pos);
    }

    /** Gönderinin alt metinleri güncel değilse düzeltir; değiştiyse true */
    public static function sync(CommentPost $post): bool
    {
        $content = (string) $post->content;
        $new = self::rewrite($content);
        if ($new === $content) return false;
        $post->setContentAttribute($new, $post->user);
        $post->save();

        return true;
    }
}
