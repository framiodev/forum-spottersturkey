<?php

namespace Framio\SocialShare\Services;

use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Support\Str;

/**
 * Foruma özel marka bilgileri (admin → Sosyal Medya → Marka ve Gönderi Metni).
 * Boş bırakılan alanlar forumun kendisinden türetilir:
 *  - ad: forum başlığı ("Spotters Turkey", "Ulaşım Arşiv")
 *  - site: forum adresinin alan adı ("forum.spottersturkey.com")
 *  - kullanıcı adı (@): alan adından ("spottersturkey")
 *  - etiket: adın boşluksuz, Türkçe karaktersiz hali ("SpottersTurkey")
 */
class Brand
{
    public const KEY = 'framio-social-share.';

    public const DEFAULT_MORE_INFO = 'Daha fazlası için: {site} | @{handle}';

    public const DEFAULT_TEMPLATE = "{header}\n\n{text}\n\n{trivia}\n\n{more_info}\n\n{kunye}\n📌 {location}\n\n📸: {author}\n\n{tags}";

    public static function get(): array
    {
        $s = resolve(SettingsRepositoryInterface::class);
        $v = fn (string $k) => trim((string) $s->get(self::KEY . $k, ''));
        $url = rtrim((string) app()->url(), '/');
        $host = (string) parse_url($url, PHP_URL_HOST);
        $root = preg_replace('/^(forum|www)\./', '', $host);
        $name = $v('brand_name') ?: (trim((string) $s->get('forum_title')) ?: $root);
        $handle = ltrim($v('brand_handle'), '@') ?: preg_replace('/[^a-z0-9_]/', '', strtolower(explode('.', $root)[0]));
        $site = $v('brand_site') ?: $host;
        $hashtag = ltrim($v('brand_hashtag'), '#') ?: preg_replace('/[^A-Za-z0-9]/', '', Str::ascii($name));
        $moreInfo = strtr($v('more_info') ?: self::DEFAULT_MORE_INFO, ['{site}' => $site, '{handle}' => $handle, '{brand}' => $name]);

        return [
            'name' => $name,
            'handle' => $handle,
            'site' => $site,
            'url' => $url,
            'hashtag' => $hashtag,
            'email' => $v('brand_email'),
            'more_info' => $moreInfo,
            'template' => $v('caption_template') ?: self::DEFAULT_TEMPLATE,
        ];
    }

    /** Gönderi metni şablonu: boş kalan değişkenlerin satırları atılır, fazla boş satırlar toplanır */
    public static function render(array $vars, ?string $template = null): string
    {
        $b = self::get();
        $tpl = $template ?: $b['template'];
        $vars += ['brand' => $b['name'], 'handle' => $b['handle'], 'site' => $b['site'], 'more_info' => $b['more_info']];
        $lines = [];
        foreach (preg_split('/\r?\n/', $tpl) as $line) {
            $used = preg_match_all('/\{([a-z_]+)\}/', $line, $m) ? $m[1] : [];
            $filled = strtr($line, array_combine(array_map(fn ($k) => '{' . $k . '}', array_keys($vars)), array_map('strval', array_values($vars))));
            // Yalnızca değişkenden oluşan ve değişkenleri boş olan satır atlanır
            if ($used && !array_filter($used, fn ($k) => trim((string) ($vars[$k] ?? '')) !== '') && trim(preg_replace('/\{[a-z_]+\}/', '', $line)) === '') continue;
            $lines[] = preg_replace('/\{[a-z_]+\}/', '', $filled);
        }

        return trim(preg_replace("/\n{3,}/", "\n\n", implode("\n", $lines)));
    }
}
