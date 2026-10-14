<?php

namespace Framio\General\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\General\Debug\DebugLog;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * GET  /api/framio/debug-logs          özet + liste (admin)
 * GET  /api/framio/debug-logs/{id}     tek kayıt, tam yığın (admin)
 * POST /api/framio/debug-logs          {action: import|resolve|resolve_source|clear|clear_resolved|test} (admin)
 * POST /api/framio/debug-logs/client   tarayıcı JS hatası (herkes; hız sınırlı)
 */
class DebugLogController implements RequestHandlerInterface
{
    public function __construct(
        protected DebugLog $log,
        protected ConnectionInterface $db,
        protected Cache $cache
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $path = $request->getUri()->getPath();
        $id = (int) Arr::get($request->getAttribute('routeParameters', []), 'id');

        if (str_ends_with($path, '/client')) {
            return $this->client($request);
        }

        RequestUtil::getActor($request)->assertAdmin();

        if ($request->getMethod() === 'POST') {
            return $this->action($request);
        }

        return $id ? $this->show($id) : $this->index($request);
    }

    private function client(ServerRequestInterface $request): ResponseInterface
    {
        $ip = Arr::get($request->getServerParams(), 'REMOTE_ADDR', 'x');
        $key = 'framio_debug_client_' . md5($ip) . '_' . floor(time() / 600);
        $n = (int) $this->cache->get($key, 0);
        if ($n < 30) { // IP başına 10 dakikada en fazla 30 kayıt
            $this->cache->put($key, $n + 1, 600);
            $body = (array) $request->getParsedBody();
            foreach (array_slice((array) Arr::get($body, 'errors', [$body]), 0, 10) as $err) {
                if (is_array($err)) {
                    $this->log->recordClient($err, $request);
                }
            }
        }

        return new JsonResponse(['ok' => true], 202);
    }

    private function index(ServerRequestInterface $request): ResponseInterface
    {
        $q = $request->getQueryParams();
        $t = DebugLog::TABLE;
        $base = $this->db->table($t);

        if (!Arr::get($q, 'resolved')) {
            $base->where('resolved', false);
        }
        foreach (['severity', 'origin', 'source', 'frontend'] as $f) {
            if ($v = Arr::get($q, $f)) {
                $base->where($f, $v);
            }
        }
        if ($s = trim((string) Arr::get($q, 'q', ''))) {
            $base->where(fn ($w) => $w->where('message', 'like', "%$s%")->orWhere('exception', 'like', "%$s%")->orWhere('file', 'like', "%$s%"));
        }

        $open = $this->db->table($t)->where('resolved', false);
        $summary = [
            'total' => (clone $open)->count(),
            'occurrences' => (int) (clone $open)->sum('count'),
            'last24h' => (clone $open)->where('last_seen_at', '>=', \Carbon\Carbon::now()->subDay())->count(),
            'bySeverity' => (clone $open)->selectRaw('severity, COUNT(*) n, SUM(count) c')->groupBy('severity')->get(),
            'bySource' => (clone $open)->selectRaw('source, MAX(source_title) title, COUNT(*) n, SUM(count) c')->groupBy('source')->orderByDesc('c')->limit(30)->get(),
            'byOrigin' => (clone $open)->selectRaw('origin, COUNT(*) n')->groupBy('origin')->get(),
            'resolved' => $this->db->table($t)->where('resolved', true)->count(),
        ];

        $rows = $base->orderByRaw("FIELD(severity,'critical','error','warning','notice')")
            ->orderByDesc('last_seen_at')
            ->limit(min(500, (int) Arr::get($q, 'limit', 200)))
            ->get(['id', 'severity', 'origin', 'frontend', 'source', 'source_title', 'exception', 'message', 'file', 'line', 'url', 'count', 'resolved', 'first_seen_at', 'last_seen_at']);

        return new JsonResponse(['summary' => $summary, 'data' => $rows]);
    }

    private function show(int $id): ResponseInterface
    {
        $row = $this->db->table(DebugLog::TABLE)->find($id);

        return $row ? new JsonResponse(['data' => $row]) : new JsonResponse(['errors' => [['status' => '404']]], 404);
    }

    private function action(ServerRequestInterface $request): ResponseInterface
    {
        $body = (array) $request->getParsedBody();
        $t = DebugLog::TABLE;

        switch (Arr::get($body, 'action')) {
            case 'import':
                return new JsonResponse(['imported' => $this->log->importLogFiles()]);
            case 'resolve':
                $this->db->table($t)->where('id', (int) Arr::get($body, 'id'))->update(['resolved' => true]);
                break;
            case 'resolve_source':
                $this->db->table($t)->where('source', (string) Arr::get($body, 'source'))->update(['resolved' => true]);
                break;
            case 'clear_resolved':
                $this->db->table($t)->where('resolved', true)->delete();
                break;
            case 'clear':
                $this->db->table($t)->delete();
                break;
            case 'test':
                // Kurulum testi: sahte bir sunucu hatası kaydı
                $this->log->recordException(new \RuntimeException('Framio Debug test kaydı — bu bir deneme hatasıdır.'), $request);
                break;
        }

        return new JsonResponse(['ok' => true]);
    }
}
