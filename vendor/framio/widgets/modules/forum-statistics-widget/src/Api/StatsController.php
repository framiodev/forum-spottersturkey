<?php

namespace Framio\Widgets\ForumStatisticsWidget\Api;

use Flarum\Http\RequestUtil;
use Framio\Widgets\ForumStatisticsWidget\StatsService;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Admin: GET  /api/framio-stats          anlık istatistikler (önbellekten)
 *        POST /api/framio-stats/refresh  önbelleği temizleyip yeniden hesaplar
 */
class StatsController implements RequestHandlerInterface
{
    public function __construct(protected StatsService $stats)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        $data = $request->getMethod() === 'POST' ? $this->stats->refresh() : $this->stats->get();

        return new JsonResponse(['data' => $data]);
    }
}
