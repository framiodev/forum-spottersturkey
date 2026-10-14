<?php

namespace Framio\UploadExif\Storage;

use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Framio\UploadExif\Database\FramioImage;

/**
 * Gönderilerdeki eski görsel adreslerini (eski uzantılı ana görsel, thumb_ ve mini_ kopyaları) görselin güncel
 * adresine çevirir. Adres hangi kodlamayla yazılmış olursa olsun (ham, %-kodlu, &amp; kaçışlı ya da karışık)
 * çalışır: görselin benzersiz zaman damgalı adı aranır, bulunan parça çözülüp karşılaştırılır ve yalnızca
 * önek/uzantı/boyut parametresi değiştirilir; adresin yazılışı olduğu gibi korunur.
 */
class PostImageUrlRepair
{
    public function __construct(protected SettingsRepositoryInterface $settings)
    {
    }

    /** @return int[] değişen gönderi kimlikleri */
    public function repair(FramioImage $image): array
    {
        $path = (string) $image->path;
        if (!preg_match('~/([^/?]+)\.(webp|jpe?g)(?:\?.*)?$~i', $path, $m)) return [];

        $stemDecoded = $this->decode($m[1]);
        $newExt = strtolower($m[2]);
        if (!preg_match('/^(\d{9,}_)/', $stemDecoded, $s)) return [];
        $stamp = $s[1];

        $dynamic = str_contains((string) $image->thumb_path, '?w=');
        $thumbWidth = (int) ($this->settings->get('framio-upload-exif.thumb_width', 1024) ?: 1024);
        $miniWidth = (int) ($this->settings->get('framio-upload-exif.mini_width', 250) ?: 250);

        // (önek)(zaman damgası + ad).(uzantı)(?w=…)
        $pattern = '~(thumb_|mini_)?(' . preg_quote($stamp, '~') . '[^"\'\]\[<>\r\n]*?)\.(jpe?g|webp)((?:\?|&amp;|&)w=\d+)?~i';

        $changed = [];
        foreach (Post::query()->where('content', 'like', '%' . $stamp . '%')->cursor() as $post) {
            $raw = $post->getRawOriginal('content');
            $new = preg_replace_callback($pattern, function ($mm) use ($stemDecoded, $newExt, $dynamic, $thumbWidth, $miniWidth) {
                if ($this->decode($mm[2]) !== $stemDecoded) return $mm[0];
                // Orijinal yedeğe dokunulmaz
                if (str_ends_with(strtolower($this->decode($mm[2])), '_orijinal')) return $mm[0];

                $prefix = strtolower($mm[1] ?? '');
                $query = $mm[4] ?? '';
                if ($dynamic && $prefix === 'thumb_') {
                    $query = '?w=' . $thumbWidth;
                } elseif ($dynamic && $prefix === 'mini_') {
                    $query = '?w=' . $miniWidth;
                } elseif (!$dynamic) {
                    return $prefix . $mm[2] . '.' . $newExt . $query;
                }

                return $mm[2] . '.' . $newExt . $query;
            }, $raw);

            if ($new !== null && $new !== $raw) {
                Post::query()->whereKey($post->id)->update(['content' => $new]);
                $changed[] = $post->id;
            }
        }

        return $changed;
    }

    /** Gönderide hâlâ eski (thumb_/mini_ ya da eski uzantılı) adres kalıp kalmadığı */
    public function hasStaleReferences(FramioImage $image): bool
    {
        $path = (string) $image->path;
        if (!preg_match('~/([^/?]+)\.(webp|jpe?g)(?:\?.*)?$~i', $path, $m)) return false;
        $stemDecoded = $this->decode($m[1]);
        $ext = strtolower($m[2]);
        if (!preg_match('/^(\d{9,}_)/', $stemDecoded, $s)) return false;

        $pattern = '~(thumb_|mini_)?(' . preg_quote($s[1], '~') . '[^"\'\]\[<>\r\n]*?)\.(jpe?g|webp)~i';
        foreach (Post::query()->where('content', 'like', '%' . $s[1] . '%')->cursor() as $post) {
            if (preg_match_all($pattern, $post->getRawOriginal('content'), $all, PREG_SET_ORDER)) {
                foreach ($all as $mm) {
                    if ($this->decode($mm[2]) !== $stemDecoded) continue;
                    if (($mm[1] ?? '') !== '' && str_contains((string) $image->thumb_path, '?w=')) return true;
                    if (strtolower($mm[3]) !== $ext) return true;
                }
            }
        }

        return false;
    }

    private function decode(string $s): string
    {
        return rawurldecode(html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }
}
