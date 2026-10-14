<?php

namespace Framio\SeoPack\Support;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Str;

/**
 * Eski adresleri (başka bir forum yazılımından taşınmış siteler vb.) yeni
 * Flarum adreslerine çözer.
 *
 * 1. Elle / otomatik kaydedilmiş yönlendirme tablosu (framio_seo_redirects)
 * 2. Admin panelindeki "Eski URL kalıpları" ayarı. Her satır:
 *      düzenli-ifade => hedef
 *    hedef: discussion | tag | user | gone | /yeni/yol/$1 | https://…
 *    discussion/tag/user türleri ilk yakalama grubunu slug olarak arar.
 */
class RedirectService
{
    public const REDIRECTS = 'framio_seo_redirects';
    public const NOT_FOUND = 'framio_seo_not_found';
    private const MAX_NOT_FOUND_ROWS = 5000;

    public function __construct(protected SeoSettings $seo, protected ConnectionInterface $db)
    {
    }

    public static function normalize(string $path, string $query = ''): string
    {
        $path = '/' . ltrim(rawurldecode($path), '/');
        $path = $path === '/' ? $path : rtrim($path, '/');

        return mb_substr($path . ($query !== '' ? '?' . $query : ''), 0, 190);
    }

    /**
     * @return array{0:int,1:?string}|null [durum kodu, hedef URL]
     */
    public function resolve(string $path, string $query): ?array
    {
        $full = self::normalize($path, $query);
        $bare = self::normalize($path);

        // 1) Kayıtlı yönlendirme (önce sorgu dahil tam eşleşme)
        $row = $this->db->table(self::REDIRECTS)->where('source', $full)->first()
            ?: ($full !== $bare ? $this->db->table(self::REDIRECTS)->where('source', $bare)->first() : null);

        if ($row) {
            $this->db->table(self::REDIRECTS)->where('id', $row->id)->update(['hits' => $row->hits + 1, 'last_hit_at' => Carbon::now()]);

            return [(int) $row->status, $row->target ? $this->absolute($row->target) : null];
        }

        // 2) Kalıplar
        foreach ($this->patterns() as [$regex, $target]) {
            if (@preg_match($regex, $full, $m) !== 1 && @preg_match($regex, $bare, $m) !== 1) {
                continue;
            }

            $status = 301;
            $url = match ($target) {
                'discussion' => $this->discussionUrl($m[1] ?? ''),
                'tag' => $this->tagUrl($m[1] ?? ''),
                'user' => $this->userUrl($m[1] ?? ''),
                'gone' => null,
                default => preg_replace_callback('/\$(\d)/', fn ($g) => rawurlencode($m[(int) $g[1]] ?? ''), $target),
            };

            if ($target === 'gone') {
                $status = 410;
            } elseif (!$url) {
                continue; // kalıp eşleşti ama karşılık yok → sonraki kalıp / 404
            }

            // Bir kez çözülen adresi tabloya yaz: sonraki isteklerde sorgu yok
            $this->remember($bare === $full ? $full : ($query === '' ? $bare : $full), $url, $status);

            return [$status, $url ? $this->absolute($url) : null];
        }

        return null;
    }

    public function logNotFound(string $path, string $query, string $referrer, string $userAgent): void
    {
        $key = self::normalize($path, $query);
        // Varlık dosyaları ve Flarum'un kendi API/yönetim yolları kaydedilmez
        if (preg_match('#^/(api|admin|assets)/|\.(css|js|map|ico|png|jpe?g|gif|webp|svg|woff2?)$#i', $key)) {
            return;
        }

        $isBot = (bool) preg_match('/bot|crawl|spider|slurp|bing|yandex|duckduck|baidu|petal|semrush|ahrefs/i', $userAgent);
        $now = Carbon::now();
        $existing = $this->db->table(self::NOT_FOUND)->where('path', $key)->first();

        if ($existing) {
            $this->db->table(self::NOT_FOUND)->where('id', $existing->id)->update([
                'hits' => $existing->hits + 1,
                'bot_hits' => $existing->bot_hits + ($isBot ? 1 : 0),
                'last_referrer' => mb_substr($referrer, 0, 255) ?: $existing->last_referrer,
                'last_user_agent' => mb_substr($userAgent, 0, 190),
                'last_seen_at' => $now,
            ]);

            return;
        }

        if ($this->db->table(self::NOT_FOUND)->count() >= self::MAX_NOT_FOUND_ROWS) {
            // Tablo dolduysa en az görülen eski kaydı at
            $this->db->table(self::NOT_FOUND)->orderBy('hits')->orderBy('last_seen_at')->limit(1)->delete();
        }

        $this->db->table(self::NOT_FOUND)->insert([
            'path' => $key,
            'hits' => 1,
            'bot_hits' => $isBot ? 1 : 0,
            'last_referrer' => mb_substr($referrer, 0, 255) ?: null,
            'last_user_agent' => mb_substr($userAgent, 0, 190),
            'last_seen_at' => $now,
            'created_at' => $now,
        ]);
    }

    public function remember(string $source, ?string $target, int $status = 301, string $origin = 'auto'): void
    {
        $source = self::normalize(parse_url($source, PHP_URL_PATH) ?: '/', (string) parse_url($source, PHP_URL_QUERY));
        $target = $target ? $this->relative($target) : null;

        $this->db->table(self::REDIRECTS)->updateOrInsert(
            ['source' => $source],
            ['target' => $target, 'status' => $status, 'origin' => $origin, 'updated_at' => Carbon::now(), 'created_at' => Carbon::now()]
        );
        $this->db->table(self::NOT_FOUND)->where('path', $source)->delete();
    }

    /** @return array<int,array{0:string,1:string}> */
    public function patterns(): array
    {
        $out = [];
        foreach (preg_split('/\R/', $this->seo->get('legacy_url_patterns')) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=>')) {
                continue;
            }
            [$regex, $target] = array_map('trim', explode('=>', $line, 2));
            $regex = '#' . str_replace('#', '\#', $regex) . '#iu';
            if (@preg_match($regex, '') !== false) {
                $out[] = [$regex, $target];
            }
        }

        return $out;
    }

    public function discussionUrl(string $slug): ?string
    {
        $slug = Str::slug(rawurldecode($slug));
        if ($slug === '') {
            return null;
        }

        $base = Discussion::where('is_private', false)->whereNull('hidden_at');

        // En yakın aday: slug uzunluğu en az farklı olan, eşitlikte en eski konu
        $closest = fn ($candidates) => $candidates
            ->sortBy(fn ($c) => [abs(strlen((string) $c->slug) - strlen($slug)), $c->id])
            ->first();

        $d = (clone $base)->where('slug', $slug)->orderBy('id')->first();

        // Tek kelimelik slug ("man") tahmin için fazla belirsiz: yalnızca tam eşleşme
        if (!$d && !str_contains($slug, '-')) {
            return null;
        }

        if (!$d) {
            // Yeni slug eskisinin devamı olabilir (başlığa kelime eklenmiş)
            $d = $closest((clone $base)->where('slug', 'like', addcslashes($slug, '%_\\') . '%')->limit(10)->get(['id', 'slug']));
        }
        if (!$d) {
            // Başlık sonradan değişmiş olabilir: anlamlı kelimelerin hepsini içeren başlık
            $words = array_values(array_filter(explode('-', $slug), fn ($w) => mb_strlen($w) > 2));
            if (count($words) >= 2) {
                $q = clone $base;
                foreach (array_slice($words, 0, 6) as $w) {
                    $q->where('slug', 'like', '%' . addcslashes($w, '%_\\') . '%');
                }
                $d = $closest($q->limit(10)->get(['id', 'slug']));
            }
        }

        return $d ? '/d/' . $d->id . ($d->slug ? '-' . $d->slug : '') : null;
    }

    public function tagUrl(string $slug): ?string
    {
        if (!class_exists(\Flarum\Tags\Tag::class)) {
            return null;
        }
        $slug = Str::slug(rawurldecode($slug));
        $tag = \Flarum\Tags\Tag::where('slug', $slug)->first();
        if (!$tag && $slug !== '') {
            // Eski adres etiket adının önüne/arkasına ek almış olabilir
            // ("site-adi-forum-hakkinda" → "forum-hakkinda"): içinde geçen en uzun etiket
            $tag = \Flarum\Tags\Tag::all(['id', 'slug'])
                ->filter(fn ($t) => strlen($t->slug) >= 4 && (str_contains($slug, $t->slug) || str_contains($t->slug, $slug)))
                ->sortByDesc(fn ($t) => strlen($t->slug))
                ->first();
        }

        return $tag ? '/t/' . $tag->slug : null;
    }

    public function userUrl(string $name): ?string
    {
        $name = rawurldecode($name);
        $slug = Str::slug($name);
        $compact = str_replace('-', '', $slug);
        $user = User::where('username', $name)
            ->orWhere('username', $slug)
            ->orWhere('username', str_replace('-', '_', $slug))
            ->orWhere('username', $compact)
            ->first();

        return $user ? '/u/' . rawurlencode($user->username) : null;
    }

    private function absolute(string $target): string
    {
        return preg_match('#^https?://#i', $target) ? $target : $this->seo->baseUrl() . '/' . ltrim($target, '/');
    }

    private function relative(string $target): string
    {
        $base = $this->seo->baseUrl();

        return str_starts_with($target, $base) ? ('/' . ltrim(substr($target, strlen($base)), '/')) : $target;
    }
}
