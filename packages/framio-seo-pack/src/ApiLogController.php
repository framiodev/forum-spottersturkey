<?php

namespace Framio\SeoPack;

use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Flarum\Foundation\Paths;

class ApiLogController implements RequestHandlerInterface
{
    protected $paths;

    public function __construct(Paths $paths)
    {
        $this->paths = $paths;
    }

    public function handle(Request $request): Response
    {
        \Flarum\Http\RequestUtil::getActor($request)->assertAdmin();

        try {
            $params = $request->getQueryParams();
            $action = $params['action'] ?? 'read';
            $logFile = $this->paths->storage . '/logs/seo-indexing.log';

            if ($action === 'clear') {
                if (file_exists($logFile)) {
                    @unlink($logFile);
                }
                return new JsonResponse(['message' => 'Loglar temizlendi.']);
            }

            $logs = [];
            if (file_exists($logFile)) {
                $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                // Son 100 log satırını gönder
                $lines = array_slice($lines, -100);
                
                foreach ($lines as $line) {
                    if (preg_match('/^\[(.*?)\]\s+(.*)$/', $line, $matches)) {
                        $logs[] = [
                            'date' => $matches[1],
                            'message' => $matches[2]
                        ];
                    } else {
                        $logs[] = [
                            'date' => 'Bilinmiyor',
                            'message' => $line
                        ];
                    }
                }
            }

            return new JsonResponse(['logs' => array_reverse($logs)]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }
}
