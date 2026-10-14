<?php

namespace Framio\SeoPack\BotCache;

use Flarum\Foundation\Paths;
use Framio\SeoPack\Support\SeoSettings;

/**
 * Arama motoru botları için sayfa önbelleği (dosya tabanlı, storage/framio-bot-cache).
 * Yalnızca botlara verilir; insan ziyaretçiler ve oturumlu istekler hiçbir zaman bu önbellekten beslenmez.
 */
class BotPageCache
{
    /** Tanınan arama motoru / önizleme botları (küçük harf, kısmi eşleşme) */
    public const BOTS = [
        'googlebot', 'google-inspectiontool', 'storebot-google', 'googleother', 'adsbot-google',
        'bingbot', 'msnbot', 'yandex', 'applebot', 'duckduckbot', 'baiduspider', 'petalbot',
        'seznambot', 'naver', 'yeti', 'facebookexternalhit', 'twitterbot', 'linkedinbot', 'whatsapp', 'telegrambot',
    ];

    public function __construct(protected SeoSettings $seo, protected Paths $paths)
    {
    }

    public function enabled(): bool
    {
        return $this->seo->bool('bot_cache_enabled');
    }

    public function ttl(): int
    {
        return max(300, (int) ($this->seo->get('bot_cache_ttl') ?: 21600));
    }

    public function maxFiles(): int
    {
        return max(100, (int) ($this->seo->get('bot_cache_max_files') ?: 5000));
    }

    public function isBot(string $userAgent): bool
    {
        $ua = strtolower($userAgent);
        foreach (self::BOTS as $bot) {
            if (str_contains($ua, $bot)) return true;
        }

        return false;
    }

    public function dir(): string
    {
        return $this->paths->storage . DIRECTORY_SEPARATOR . 'framio-bot-cache';
    }

    private function file(string $key): string
    {
        return $this->dir() . DIRECTORY_SEPARATOR . sha1($key) . '.html';
    }

    /** @return array{body:string, type:string}|null */
    public function get(string $key): ?array
    {
        $file = $this->file($key);
        if (!is_file($file) || filemtime($file) < time() - $this->ttl()) return null;

        $raw = @file_get_contents($file);
        if ($raw === false || !str_contains($raw, "\n")) return null;
        [$type, $body] = explode("\n", $raw, 2);

        return ['type' => $type, 'body' => $body];
    }

    public function put(string $key, string $body, string $type): void
    {
        $dir = $this->dir();
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) return;

        $this->prune();
        $tmp = $this->file($key) . '.' . getmypid() . '.tmp';
        if (@file_put_contents($tmp, $type . "\n" . $body) !== false) {
            @rename($tmp, $this->file($key));
        }
    }

    /** Bütün önbelleği temizler (içerik değiştiğinde) */
    public function flush(): int
    {
        $n = 0;
        foreach (glob($this->dir() . DIRECTORY_SEPARATOR . '*.html') ?: [] as $file) {
            if (@unlink($file)) $n++;
        }

        return $n;
    }

    /** Dosya sayısı sınırı aşılırsa en eski dosyaları siler (inode sınırına karşı) */
    private function prune(): void
    {
        $files = glob($this->dir() . DIRECTORY_SEPARATOR . '*.html') ?: [];
        if (count($files) < $this->maxFiles()) return;

        usort($files, fn ($a, $b) => filemtime($a) <=> filemtime($b));
        foreach (array_slice($files, 0, (int) ceil(count($files) / 5)) as $file) {
            @unlink($file);
        }
    }

    public function stats(): array
    {
        $files = glob($this->dir() . DIRECTORY_SEPARATOR . '*.html') ?: [];
        $size = array_sum(array_map('filesize', $files));

        return ['files' => count($files), 'bytes' => $size];
    }
}
