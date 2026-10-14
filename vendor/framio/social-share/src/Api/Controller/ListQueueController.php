<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Illuminate\Database\ConnectionInterface;

class ListQueueController implements RequestHandlerInterface
{
    protected $db;

    public function __construct(ConnectionInterface $db)
    {
        $this->db = $db;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        $queue = $this->db->table('framio_social_queue')
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        $formatted = $queue->map(function ($item) {
            $item->payload = json_decode($item->payload);
            return $item;
        });

        return new JsonResponse($formatted->values()->all());
    }
}