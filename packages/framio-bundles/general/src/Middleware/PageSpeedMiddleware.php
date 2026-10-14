<?php

namespace Framio\General\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Illuminate\Database\ConnectionInterface;

/**
 * Hız optimizasyonu:
 *  - Header (X-Page-Speed-Ms) her zaman eklenir; ölçüm sürer.
 *  - VERİTABANI INSERT'İ ARTIK HER İSTEKTE YAPILMAZ.
 *    Yalnızca "yavaş" (>= 1500 ms) istekler kaydedilir; ayrıca örnekleme (1/25)
 *    ile normal istekler seyrek yakalanır. Böylece framio_speed_metrics tablosu
 *    şişmez ve her istekte ekstra DB round-trip yaşanmaz.
 */
class PageSpeedMiddleware implements MiddlewareInterface
{
    /** Yavaş sayılan eşik (ms). */
    const SLOW_THRESHOLD_MS = 1500;

    /** Normal (yavaş olmayan) isteklerin örnekleme oranı: 1/N. */
    const SAMPLING_RATE = 25;

    protected $db;

    public function __construct(ConnectionInterface $db)
    {
        $this->db = $db;
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $startTime = microtime(true);

        $response = $handler->handle($request);

        $durationMs = (int) round((microtime(true) - $startTime) * 1000);
        $response = $response->withHeader('X-Page-Speed-Ms', (string) $durationMs);

        $path = $request->getUri()->getPath();

        // /api/framio kendisi kendini metrikleyemesin (döngü engeli)
        if (strpos($path, '/api/framio') !== false) {
            return $response;
        }

        // Yalnızca yavaş isteklerde yaz, ya da 1/25 oranında örnekle
        $shouldRecord = ($durationMs >= self::SLOW_THRESHOLD_MS)
            || (mt_rand(1, self::SAMPLING_RATE) === 1);

        if ($shouldRecord) {
            try {
                $this->db->table('framio_speed_metrics')->insert([
                    'type' => $durationMs >= self::SLOW_THRESHOLD_MS ? 'slow_backend' : 'sampled_backend',
                    'url' => substr($path, 0, 190),
                    'duration_ms' => $durationMs,
                    'created_at' => date('Y-m-d H:i:s'),
                ]);
            } catch (\Exception $e) {
                // migrasyon çalışmamış olabilir; sessiz geç
            }
        }

        return $response;
    }
}
