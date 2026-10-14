<?php

namespace Framio\General\Api\Controller;

use Illuminate\Database\ConnectionInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class RecordMetricController implements RequestHandlerInterface
{
    protected $db;

    public function __construct(ConnectionInterface $db)
    {
        $this->db = $db;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $body = $request->getParsedBody();
        $metrics = $body['metrics'] ?? [];

        if (empty($metrics) || !is_array($metrics)) {
            return new JsonResponse(['status' => 'ignored'], 200);
        }

        $inserted = 0;
        foreach ($metrics as $metric) {
            $type = $metric['type'] ?? null;
            $url = $metric['url'] ?? null;
            $durationMs = isset($metric['duration_ms']) ? (int)$metric['duration_ms'] : null;

            if ($type && $durationMs !== null) {
                try {
                    $this->db->table('framio_speed_metrics')->insert([
                        'type' => substr($type, 0, 50),
                        'url' => $url,
                        'duration_ms' => $durationMs,
                        'created_at' => date('Y-m-d H:i:s'),
                    ]);
                    $inserted++;
                } catch (\Exception $e) {
                    // Ignore errors (e.g. table not migrated yet)
                }
            }
        }

        return new JsonResponse(['status' => 'success', 'inserted' => $inserted]);
    }
}
