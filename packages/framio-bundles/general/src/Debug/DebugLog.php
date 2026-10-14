<?php

namespace Framio\General\Debug;

use Carbon\Carbon;
use Flarum\Extension\ExtensionManager;
use Flarum\Foundation\Paths;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\ConnectionInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

/**
 * Hata günlüğü: sunucu istisnaları, tarayıcı (JS) hataları ve Flarum log
 * dosyası kayıtlarını tek tabloda toplar. Aynı hata parmak iziyle
 * gruplanır; kaynak eklenti dosya yolundan (PHP) veya derlenmiş
 * forum.js/admin.js satır aralığından (JS) bulunur.
 */
class DebugLog
{
    public const TABLE = 'framio_debug_logs';

    /** @var array<string,array{id:string,title:string}>|null */
    private ?array $pathMap = null;

    public function __construct(
        protected ConnectionInterface $db,
        protected ExtensionManager $extensions,
        protected Paths $paths,
        protected SettingsRepositoryInterface $settings
    ) {
    }

    public function enabled(): bool
    {
        return (bool) $this->settings->get('framio-general.debug_log_enabled', true);
    }

    // ─────────────────────────────────────────────── Kayıt

    public function recordException(Throwable $e, ?ServerRequestInterface $request = null): void
    {
        RequestContext::$reported = true; // aynı istek yanıt olarak ikinci kez kaydedilmesin
        if (!$this->enabled()) {
            return;
        }

        [$file, $line] = $this->firstAppFrame($e);
        $source = $this->sourceForPath($file) ?? $this->sourceForPath($e->getFile());

        $this->store([
            'severity' => $this->severityFor($e),
            'origin' => 'server',
            'frontend' => $this->frontendFor($request),
            'source' => $source['id'] ?? 'core',
            'source_title' => $source['title'] ?? 'Flarum Çekirdeği',
            'exception' => get_class($e),
            'message' => $e->getMessage() ?: get_class($e),
            'file' => $this->relative($file),
            'line' => $line,
            'trace' => $this->traceText($e),
            'context' => $this->requestContext($request),
            'url' => $request ? $this->originalUri($request) : null,
        ]);
    }

    /**
     * Eklentinin kendi yakalayıp hata yanıtı olarak döndürdüğü istek.
     * Kaynak, rotanın denetleyici sınıfının dosyasından bulunur.
     */
    public function recordResponse(ServerRequestInterface $request, \Psr\Http\Message\ResponseInterface $response): void
    {
        if (!$this->enabled()) {
            return;
        }

        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        $json = json_decode($body, true);
        $message = $json['error']
            ?? ($json['errors'][0]['detail'] ?? null)
            ?? ($json['errors'][0]['code'] ?? null)
            ?? ($json['message'] ?? null)
            ?? trim(strip_tags(mb_substr($body, 0, 300)));
        if (is_array($message)) {
            $message = json_encode($message, JSON_UNESCAPED_UNICODE);
        }

        $routeName = (string) $request->getAttribute('routeName');
        $handler = $this->handlerClassFor($routeName);
        $file = $handler ? (new \ReflectionClass($handler))->getFileName() : null;
        $source = $this->sourceForPath($file);

        $this->store([
            'severity' => $status >= 500 ? 'error' : 'warning',
            'origin' => 'server',
            'frontend' => $this->frontendFor($request),
            'source' => $source['id'] ?? 'core',
            'source_title' => $source['title'] ?? 'Flarum Çekirdeği',
            'exception' => 'HTTP ' . $status . ($handler ? ' · ' . basename(str_replace('\\', '/', $handler)) : ''),
            'message' => (string) ($message ?: 'HTTP ' . $status),
            'file' => $this->relative($file),
            'line' => null,
            'trace' => "Yanıt gövdesi (ilk 4000 karakter):\n" . mb_substr($body, 0, 4000),
            'context' => $this->requestContext($request),
            'url' => $this->originalUri($request),
        ]);
    }

    /** Rota adından denetleyici sınıfı (forum/admin/api rota koleksiyonlarında arar) */
    private function handlerClassFor(string $routeName): ?string
    {
        if ($routeName === '') {
            return null;
        }
        foreach (['flarum.api.routes', 'flarum.forum.routes', 'flarum.admin.routes'] as $binding) {
            try {
                $routes = resolve($binding);
                $prop = new \ReflectionProperty($routes, 'routes');
                $handler = ((array) $prop->getValue($routes))[$routeName]['handler'] ?? null;
                // Flarum denetleyiciyi kapanış (RouteHandlerFactory) içinde saklar
                if ($handler instanceof \Closure) {
                    $handler = (new \ReflectionFunction($handler))->getStaticVariables()['controller'] ?? null;
                }
                if (is_string($handler) && class_exists($handler)) {
                    return $handler;
                }
            } catch (Throwable $e) {
            }
        }

        return null;
    }

    /** Tarayıcıdan gelen JS hatası */
    public function recordClient(array $data, ServerRequestInterface $request): void
    {
        if (!$this->enabled() || !$this->settings->get('framio-general.debug_log_client', true)) {
            return;
        }

        $stack = mb_substr((string) ($data['stack'] ?? ''), 0, 20000);
        $frontend = in_array($data['frontend'] ?? '', ['forum', 'admin'], true) ? $data['frontend'] : 'forum';
        $source = $this->sourceForStack($stack, $frontend);
        $message = mb_substr(trim((string) ($data['message'] ?? 'Bilinmeyen JS hatası')), 0, 2000);

        $this->store([
            'severity' => ($data['kind'] ?? '') === 'console' ? 'warning' : 'error',
            'origin' => 'client',
            'frontend' => $frontend,
            'source' => $source['id'] ?? 'core',
            'source_title' => $source['title'] ?? 'Flarum Çekirdeği (JS)',
            'exception' => mb_substr((string) ($data['name'] ?? 'Error'), 0, 190),
            'message' => $message,
            'file' => mb_substr((string) ($data['file'] ?? ''), 0, 500) ?: null,
            'line' => isset($data['line']) ? (int) $data['line'] : null,
            'trace' => $stack,
            'context' => json_encode([
                'sayfa' => mb_substr((string) ($data['url'] ?? ''), 0, 500),
                'rota' => mb_substr((string) ($data['route'] ?? ''), 0, 120),
                'tarayıcı' => mb_substr($request->getHeaderLine('User-Agent'), 0, 300),
                'kullanıcı' => $data['user'] ?? null,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'url' => mb_substr((string) ($data['url'] ?? ''), 0, 500) ?: null,
        ]);
    }

    /** storage/logs/*.log dosyalarındaki kayıtları içe aktarır */
    public function importLogFiles(int $maxFiles = 7): int
    {
        $dir = $this->paths->storage . '/logs';
        $files = glob($dir . '/*.log') ?: [];
        rsort($files);
        $count = 0;

        // Dosya başına okunan bayt; tekrar içe aktarmada sayılar katlanmasın
        $marks = json_decode((string) $this->settings->get('framio-general.debug_log_import_marks', '{}'), true) ?: [];

        foreach (array_slice($files, 0, $maxFiles) as $logFile) {
            $size = (int) @filesize($logFile);
            $from = (int) ($marks[basename($logFile)] ?? 0);
            if ($from > $size) {
                $from = 0; // dosya döndürülmüş
            }
            $marks[basename($logFile)] = $size;
            if ($size - $from <= 0) {
                continue;
            }
            $content = @file_get_contents($logFile, false, null, max($from, $size - 5_000_000));
            if (!$content) {
                continue;
            }
            // [2026-09-29T21:10:00.123+03:00] flarum.ERROR: mesaj {bağlam}
            $parts = preg_split('/^(?=\[\d{4}-\d{2}-\d{2}[T ][^\]]*\]\s+\w+\.\w+:)/m', $content, -1, PREG_SPLIT_NO_EMPTY);
            foreach ($parts as $entry) {
                if (!preg_match('/^\[([^\]]+)\]\s+\w+\.(\w+):\s*(.*)$/s', trim($entry), $m)) {
                    continue;
                }
                [$all, $date, $level, $body] = $m;
                $level = strtoupper($level);
                if (!in_array($level, ['EMERGENCY', 'ALERT', 'CRITICAL', 'ERROR', 'WARNING'], true)) {
                    continue;
                }

                $firstLine = strtok($body, "\n");
                $file = null;
                $line = null;
                if (preg_match('/ in ((?:[A-Za-z]:)?[^\s:]+\.php):(\d+)/', $body, $fm)) {
                    [$file, $line] = [$fm[1], (int) $fm[2]];
                }
                $class = preg_match('/^([A-Z][\w\\\\]+(?:Exception|Error))\b/', $firstLine, $cm) ? $cm[1] : null;
                $source = $this->sourceForPath($this->appFrameFromText($body) ?? $file);

                $this->store([
                    'severity' => match ($level) {
                        'EMERGENCY', 'ALERT', 'CRITICAL' => 'critical',
                        'ERROR' => $class && str_ends_with($class, 'Error') ? 'critical' : 'error',
                        default => 'warning',
                    },
                    'origin' => 'log',
                    'frontend' => null,
                    'source' => $source['id'] ?? 'core',
                    'source_title' => $source['title'] ?? 'Flarum Çekirdeği',
                    'exception' => $class,
                    'message' => mb_substr($firstLine, 0, 2000),
                    'file' => $this->relative($file),
                    'line' => $line,
                    'trace' => mb_substr($body, 0, 60000),
                    'context' => json_encode(['kaynak' => 'storage/logs/' . basename($logFile), 'tarih' => $date], JSON_UNESCAPED_UNICODE),
                    'url' => null,
                ], $this->parseDate($date));
                $count++;
            }
        }

        $marks = array_intersect_key($marks, array_flip(array_map('basename', $files)));
        $this->settings->set('framio-general.debug_log_import_marks', json_encode($marks));

        return $count;
    }

    private function store(array $row, ?Carbon $at = null): void
    {
        try {
            $at = $at ?? Carbon::now();
            // Parmak izi: sayı/kimlik farkları aynı hatayı bölmesin
            $normalized = preg_replace(['/\d+/', '/\'[^\']*\'|"[^"]*"/'], ['N', 'S'], (string) $row['message']);
            $row['fingerprint'] = sha1(implode('|', [$row['origin'], $row['exception'], $row['file'], $row['line'], mb_substr($normalized, 0, 300)]));
            $row['message'] = mb_substr((string) $row['message'], 0, 5000);

            $existing = $this->db->table(self::TABLE)->where('fingerprint', $row['fingerprint'])->first(['id', 'last_seen_at']);
            if ($existing) {
                $update = ['count' => $this->db->raw('count + 1'), 'resolved' => false];
                if (Carbon::parse($existing->last_seen_at)->lt($at)) {
                    $update += ['last_seen_at' => $at, 'context' => $row['context'], 'url' => $row['url'], 'trace' => $row['trace']];
                }
                $this->db->table(self::TABLE)->where('id', $existing->id)->update($update);

                return;
            }

            $this->db->table(self::TABLE)->insert($row + ['count' => 1, 'first_seen_at' => $at, 'last_seen_at' => $at]);
            $this->prune();
        } catch (Throwable $ignored) {
            // Günlük tutarken çıkan hata forumu asla bozmamalı
        }
    }

    private function prune(): void
    {
        $max = max(100, (int) $this->settings->get('framio-general.debug_log_max', 2000));
        $total = $this->db->table(self::TABLE)->count();
        if ($total > $max) {
            $ids = $this->db->table(self::TABLE)->orderBy('last_seen_at')->limit($total - $max)->pluck('id');
            $this->db->table(self::TABLE)->whereIn('id', $ids)->delete();
        }
    }

    // ─────────────────────────────────────────────── Sınıflandırma

    public function severityFor(Throwable $e): string
    {
        if ($e instanceof \Error) {
            return 'critical'; // TypeError, ParseError, fatal…
        }
        if ($e instanceof \PDOException || $e instanceof \Illuminate\Database\QueryException) {
            return 'critical';
        }

        return 'error';
    }

    private function frontendFor(?ServerRequestInterface $request): ?string
    {
        if (!$request) {
            return PHP_SAPI === 'cli' ? 'console' : null;
        }
        $path = parse_url($this->originalUri($request), PHP_URL_PATH) ?: '/';
        if (str_contains($path, '/api/') || str_ends_with($path, '/api')) {
            return 'api';
        }

        return str_contains($path, '/admin') ? 'admin' : 'forum';
    }

    /** Çekirdek/vendor dışındaki ilk yığın satırı (sorumlu eklenti) */
    private function firstAppFrame(Throwable $e): array
    {
        $frames = array_merge([['file' => $e->getFile(), 'line' => $e->getLine()]], $e->getTrace());
        foreach ($frames as $f) {
            $file = $f['file'] ?? null;
            if ($file && $this->sourceForPath($file) && !$this->isCorePath($file)) {
                return [$file, $f['line'] ?? null];
            }
        }

        return [$e->getFile(), $e->getLine()];
    }

    private function appFrameFromText(string $text): ?string
    {
        if (preg_match_all('/#\d+ ([^\s(]+\.php)\(\d+\)/', $text, $m)) {
            foreach ($m[1] as $file) {
                if ($this->sourceForPath($file) && !$this->isCorePath($file)) {
                    return $file;
                }
            }
        }

        return null;
    }

    private function isCorePath(string $file): bool
    {
        $f = str_replace('\\', '/', $file);

        return str_contains($f, '/vendor/flarum/core/') || str_contains($f, '/vendor/illuminate/') || str_contains($f, '/vendor/laminas/');
    }

    /** Dosya yolundan eklenti (paketli modüller dahil) */
    public function sourceForPath(?string $file): ?array
    {
        if (!$file) {
            return null;
        }
        $f = str_replace('\\', '/', $file);

        if ($this->pathMap === null) {
            $this->pathMap = [];
            foreach ($this->extensions->getExtensions() as $ext) {
                $path = str_replace('\\', '/', (string) (realpath($ext->getPath()) ?: $ext->getPath()));
                $this->pathMap[rtrim($path, '/') . '/'] = ['id' => $ext->getId(), 'title' => $ext->getTitle() ?: $ext->getId()];
                // vendor/ altındaki bağlantı (junction/symlink) yolu da
                $vendorPath = str_replace('\\', '/', $this->paths->vendor . '/' . $ext->name);
                $this->pathMap[rtrim($vendorPath, '/') . '/'] = ['id' => $ext->getId(), 'title' => $ext->getTitle() ?: $ext->getId()];
            }
            uksort($this->pathMap, fn ($a, $b) => strlen($b) <=> strlen($a));
        }

        foreach ($this->pathMap as $prefix => $info) {
            if (stripos($f, $prefix) === 0) {
                // Konsolide paket içindeki modül: …/modules/<modül>/…
                if (preg_match('#/modules/([^/]+)/#', substr($f, strlen($prefix) - 1), $mm)) {
                    return ['id' => $info['id'] . ':' . $mm[1], 'title' => $info['title'] . ' › ' . $mm[1] . ' modülü'];
                }

                return $info;
            }
        }

        if (str_contains($f, '/vendor/flarum/core/')) {
            return ['id' => 'core', 'title' => 'Flarum Çekirdeği'];
        }
        if (preg_match('#/vendor/([^/]+/[^/]+)/#', $f, $vm)) {
            return ['id' => 'lib:' . $vm[1], 'title' => 'Kütüphane: ' . $vm[1]];
        }

        return null;
    }

    /** JS yığınındaki forum.js:SATIR bilgisinden eklenti */
    private function sourceForStack(string $stack, string $frontend): ?array
    {
        if (!preg_match_all('#/assets/(forum|admin)[^/\s:]*\.js(?:\?[^:\s]*)?:(\d+):\d+#', $stack, $m, PREG_SET_ORDER)) {
            return null;
        }

        foreach ($m as $hit) {
            $ranges = $this->bundleRanges($hit[1]);
            $line = (int) $hit[2];
            foreach ($ranges as [$end, $id]) {
                if ($line <= $end) {
                    if ($id === 'core') {
                        continue 2; // çekirdek karesi; bir sonrakine bak
                    }
                    $ext = $this->extensions->getExtension($id);

                    return ['id' => $id, 'title' => ($ext ? $ext->getTitle() : $id) . ' (JS)'];
                }
            }
        }

        return ['id' => 'core', 'title' => 'Flarum Çekirdeği (JS)'];
    }

    /** Derlenmiş paket: her eklenti bloğu flarum.extensions['id']=… satırıyla biter */
    private function bundleRanges(string $bundle): array
    {
        $file = $this->paths->public . '/assets/' . $bundle . '.js';
        if (!is_file($file)) {
            return [];
        }
        static $cache = [];
        $key = $file . filemtime($file);
        if (isset($cache[$key])) {
            return $cache[$key];
        }

        $ranges = [];
        $n = 0;
        $firstExt = null;
        $h = fopen($file, 'r');
        while (($row = fgets($h)) !== false) {
            $n++;
            if (preg_match("/^flarum\.extensions\['([^']+)'\]=module\.exports/", $row, $mm)) {
                $ranges[] = [$n, $mm[1]];
                $firstExt ??= $n;
            }
        }
        fclose($h);
        // İlk eklentiden önceki satırlar çekirdeğe aittir
        array_unshift($ranges, [max(0, ($firstExt ?? 1) - 8), 'core']);

        return $cache[$key] = $ranges;
    }

    // ─────────────────────────────────────────────── Yardımcılar

    private function relative(?string $file): ?string
    {
        if (!$file) {
            return null;
        }
        $base = str_replace('\\', '/', $this->paths->base);

        return str_replace($base . '/', '', str_replace('\\', '/', $file));
    }

    private function traceText(Throwable $e): string
    {
        $out = '';
        $i = 0;
        for ($x = $e; $x && $i < 4; $x = $x->getPrevious(), $i++) {
            $out .= ($i ? "\n\nÖnceki istisna: " : '') . get_class($x) . ': ' . $x->getMessage()
                . "\n" . $this->relative($x->getFile()) . ':' . $x->getLine()
                . "\n" . str_replace(str_replace('/', DIRECTORY_SEPARATOR, $this->paths->base) . DIRECTORY_SEPARATOR, '', $x->getTraceAsString());
        }

        return mb_substr($out, 0, 60000);
    }

    private function requestContext(?ServerRequestInterface $request): ?string
    {
        if (!$request) {
            return json_encode(['ortam' => PHP_SAPI], JSON_UNESCAPED_UNICODE);
        }
        $actor = $request->getAttribute('actor');
        $query = $request->getQueryParams();

        return json_encode([
            'yöntem' => $request->getMethod(),
            'adres' => $this->originalUri($request),
            'rota' => $request->getAttribute('routeName'),
            'sorgu' => $query ?: null,
            'kullanıcı' => $actor && !$actor->isGuest() ? ['id' => $actor->id, 'ad' => $actor->username] : 'misafir',
            'tarayıcı' => mb_substr($request->getHeaderLine('User-Agent'), 0, 300),
            'yönlendiren' => $request->getHeaderLine('Referer') ?: null,
            'php' => PHP_VERSION,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    }

    private function originalUri(ServerRequestInterface $request): string
    {
        $uri = $request->getAttribute('originalUri') ?? $request->getUri();

        return (string) $uri;
    }

    private function parseDate(string $date): Carbon
    {
        try {
            return Carbon::parse($date)->setTimezone(date_default_timezone_get());
        } catch (Throwable $e) {
            return Carbon::now();
        }
    }
}
