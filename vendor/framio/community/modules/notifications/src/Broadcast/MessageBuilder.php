<?php

namespace Framio\Community\Notifications\Broadcast;

use Flarum\Http\UrlGenerator;
use Flarum\Post\CommentPost;
use Flarum\Settings\SettingsRepositoryInterface;

/**
 * Kuyruktaki mesajlardan grup mesajı metni üretir: künye satırları, konu başlığı,
 * yazar, ilk fotoğraf ve mesaja giden bağlantı.
 */
class MessageBuilder
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected UrlGenerator $url
    ) {
    }

    /** @return array{title:string, author:string, url:string, lines:string[], image:?string, images:string[], kind:string} */
    public function item(CommentPost $post, string $kind): array
    {
        $discussion = $post->discussion;
        $raw = (string) $post->content; // Flarum ham (BBCode/Markdown) metni döndürür

        // Künye: mesajdaki "- **Firma | Plaka**" biçimindeki madde satırları
        $lines = [];
        foreach (preg_split('/\R/', $raw) as $line) {
            if (preg_match('/^\s*[-*•]\s+(.+)$/u', $line, $m)) {
                $text = trim(preg_replace('/\*\*|__|\[\/?[a-z0-9-]+[^\]]*\]/iu', '', $m[1]));
                if ($text !== '') {
                    $lines[] = $text;
                }
            }
        }

        // Fotoğraflar: medya etiketlerindeki url="…" ve Markdown resimleri
        $images = [];
        if (preg_match_all('/\burl=["\']([^"\']+\.(?:jpe?g|png|webp)(?:\?[^"\']*)?)["\']/iu', $raw, $m)) {
            $images = $m[1];
        }
        if (preg_match_all('/!\[[^\]]*\]\(([^)\s]+)\)/u', $raw, $m)) {
            $images = array_merge($images, $m[1]);
        }
        $images = array_values(array_unique(array_filter($images, fn ($u) => str_starts_with($u, 'http'))));
        // Dosya adlarındaki boşluklar (Telegram adresi kendisi indirir)
        $images = array_map(fn ($u) => str_replace(' ', '%20', $u), $images);

        // Künye yoksa metnin başından kısa bir özet
        if (!$lines) {
            $plain = trim(preg_replace('/\s+/u', ' ', preg_replace('/\[[^\]]*\]|!\[[^\]]*\]\([^)]*\)|[*_#>`]/u', ' ', $raw)));
            if ($plain !== '') {
                $lines[] = mb_strlen($plain) > 160 ? mb_substr($plain, 0, 157) . '…' : $plain;
            }
        }

        $user = $post->user;

        return [
            'kind' => $kind,
            'title' => (string) ($discussion->title ?? ''),
            'author' => $user ? (string) ($user->display_name ?: $user->username) : '',
            'url' => $this->url->to('forum')->route('discussion', ['id' => $discussion->id . ($discussion->slug ? '-' . $discussion->slug : ''), 'near' => $post->number]),
            'lines' => array_slice($lines, 0, 4),
            'image' => $images[0] ?? null,
            'images' => $images,
        ];
    }

    protected function siteName(): string
    {
        return (string) ($this->settings->get('forum_title') ?: 'Forum');
    }

    /** Telegram (HTML biçimi) */
    public function telegram(array $items): string
    {
        // Telegram HTML yalnızca &lt; &gt; &amp; &quot; tanır
        $e = fn ($s) => htmlspecialchars((string) $s, ENT_COMPAT | ENT_HTML401, 'UTF-8');

        if (count($items) === 1) {
            $it = $items[0];
            $head = $it['kind'] === 'discussion' ? '🆕 <b>Yeni konu:</b> ' : '📸 <b>Yeni paylaşım:</b> ';
            $out = $head . $e($it['title']) . "\n";
            foreach ($it['lines'] as $l) {
                $out .= '• ' . $e($l) . "\n";
            }
            if ($it['author']) {
                $out .= '👤 ' . $e($it['author']) . "\n";
            }

            return $out . "\n" . '<a href="' . $e($it['url']) . '">➡️ Forumda görüntüle</a>';
        }

        $out = '📢 <b>' . $e($this->siteName()) . ' — ' . count($items) . " yeni paylaşım</b>\n\n";
        foreach ($items as $i => $it) {
            $label = $it['lines'][0] ?? $it['title'];
            $out .= ($i + 1) . '. <a href="' . $e($it['url']) . '">' . $e($label) . '</a>';
            if (isset($it['lines'][1])) {
                $out .= ' — ' . $e($it['lines'][1]);
            }
            $out .= "\n";
        }

        return rtrim($out);
    }

    /** WhatsApp (düz metin; *kalın* WhatsApp biçimi) */
    public function whatsapp(array $items): string
    {
        if (count($items) === 1) {
            $it = $items[0];
            $out = ($it['kind'] === 'discussion' ? '🆕 *Yeni konu:* ' : '📸 *Yeni paylaşım:* ') . $it['title'] . "\n";
            foreach ($it['lines'] as $l) {
                $out .= '• ' . $l . "\n";
            }
            if ($it['author']) {
                $out .= '👤 ' . $it['author'] . "\n";
            }

            return $out . "\n" . $it['url'];
        }

        $out = '📢 *' . $this->siteName() . ' — ' . count($items) . " yeni paylaşım*\n\n";
        foreach ($items as $i => $it) {
            $out .= ($i + 1) . '. ' . ($it['lines'][0] ?? $it['title']) . "\n" . $it['url'] . "\n\n";
        }

        return rtrim($out);
    }
}
