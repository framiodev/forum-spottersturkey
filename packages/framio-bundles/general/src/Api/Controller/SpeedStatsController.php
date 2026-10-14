<?php

namespace Framio\General\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Foundation\Paths;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class SpeedStatsController implements RequestHandlerInterface
{
    protected $db;
    protected $paths;
    protected $cache;

    public function __construct(ConnectionInterface $db, Paths $paths, CacheRepository $cache)
    {
        $this->db = $db;
        $this->paths = $paths;
        $this->cache = $cache;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if (!$actor->isAdmin()) {
            return new JsonResponse(['error' => 'Permission denied'], 403);
        }

        $method = $request->getMethod();
        if ($method === 'POST') {
            $body = $request->getParsedBody();
            $action = $body['action'] ?? '';

            if ($action === 'clear_cache') {
                // Clear Flarum's formatter cache, views, assets
                $this->cache->clear();
                
                // Clear LESS/JS assets in storage
                $this->clearDirectory($this->paths->storage . '/locale');
                $this->clearDirectory($this->paths->storage . '/views');
                
                // Clean assets dir
                $this->clearDirectory($this->paths->public . '/assets');

                return new JsonResponse(['status' => 'success', 'message' => 'Cache cleared successfully.']);
            }

            if ($action === 'clear_metrics') {
                $this->db->table('framio_speed_metrics')->truncate();
                return new JsonResponse(['status' => 'success', 'message' => 'Metrics history cleared.']);
            }

            return new JsonResponse(['error' => 'Invalid action'], 400);
        }

        // Gather metrics
        $stats = [
            'backend_avg' => round($this->db->table('framio_speed_metrics')->where('type', 'backend_response')->avg('duration_ms') ?? 0),
            'frontend_avg' => round($this->db->table('framio_speed_metrics')->where('type', 'page_load')->avg('duration_ms') ?? 0),
            'images_avg' => round($this->db->table('framio_speed_metrics')->where('type', 'image_load')->avg('duration_ms') ?? 0),
            'total_measurements' => $this->db->table('framio_speed_metrics')->count(),
            'slowest_images' => $this->db->table('framio_speed_metrics')
                ->where('type', 'image_load')
                ->selectRaw('url, AVG(duration_ms) as avg_duration, COUNT(*) as load_count')
                ->groupBy('url')
                ->orderByDesc('avg_duration')
                ->limit(10)
                ->get(),
            'system' => [
                'php_version' => PHP_VERSION,
                'opcache_enabled' => function_exists('opcache_get_status') && !empty(opcache_get_status()),
                'cache_driver' => get_class($this->cache),
                'storage_cache_size' => $this->getDirectorySize($this->paths->storage . '/cache'),
                'storage_views_size' => $this->getDirectorySize($this->paths->storage . '/views'),
                'public_assets_size' => $this->getDirectorySize($this->paths->public . '/assets'),
            ]
        ];

        return new JsonResponse($stats);
    }

    protected function getDirectorySize($path): string
    {
        if (!is_dir($path)) {
            return '0 B';
        }
        $size = 0;
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS)) as $file) {
            $size += $file->getSize();
        }
        
        $units = ['B', 'KB', 'MB', 'GB'];
        $power = $size > 0 ? floor(log($size, 1024)) : 0;
        return number_format($size / pow(1024, $power), 2) . ' ' . $units[$power];
    }

    protected function clearDirectory($path): void
    {
        if (!is_dir($path)) return;
        $files = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($path, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($files as $fileinfo) {
            $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
            @$todo($fileinfo->getRealPath());
        }
    }
}
