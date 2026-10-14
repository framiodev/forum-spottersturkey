<?php

namespace Framio\SocialShare\Api\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Illuminate\Database\ConnectionInterface;
use Framio\SocialShare\Services\MetaService;
use Carbon\Carbon;

class TriggerScheduleController implements RequestHandlerInterface
{
    protected $metaService;
    protected $db;

    public function __construct(MetaService $metaService, ConnectionInterface $db)
    {
        $this->metaService = $metaService;
        $this->db = $db;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        set_time_limit(300);

        $queryParams = $request->getQueryParams();
        if (!isset($queryParams['key']) || $queryParams['key'] !== 'GizliSifreFramio123') {
            return new JsonResponse(['error' => 'Yetkisiz Giris'], 401);
        }

        $now = Carbon::now('Europe/Istanbul')->toDateTimeString();

        $posts = $this->db->table('framio_social_queue')
            ->where('status', 'pending')
            ->where('scheduled_at', '<=', $now)
            ->get();

        if ($posts->isEmpty()) {
            return new JsonResponse(['status' => 'Bekleyen gonderi yok', 'server_time' => $now]);
        }

        $results = [];

        foreach ($posts as $post) {
            $payload = json_decode($post->payload, true);
            
            $platform = $payload['platform'] ?? null;
            $type = $payload['type'] ?? null;
            $igId = $payload['igId'] ?? null;
            $userToken = $payload['userToken'] ?? null;

            try {
                if ($platform === 'facebook_story') {
                    $imageUrl = $payload['image_url'] ?? ($payload['images'][0] ?? null);
                    if (!$imageUrl) {
                        throw new \Exception("Facebook hikaye görseli bulunamadı.");
                    }
                    $pageId = $payload['target_id'] ?? ($payload['pageId'] ?? null);
                    if (!$pageId) {
                        throw new \Exception("Facebook Sayfa ID bulunamadı.");
                    }
                    $response = $this->metaService->postStoryToFacebook($pageId, $imageUrl, $userToken);
                } elseif ($platform === 'instagram_story' || $type === 'story') {
                    $imageUrl = $payload['image_url'] ?? ($payload['images'][0] ?? null);
                    if (!$imageUrl) {
                        throw new \Exception("Instagram hikaye görseli bulunamadı.");
                    }
                    $targetIgId = $payload['target_id'] ?? $igId;
                    $response = $this->metaService->postStoryToInstagram($targetIgId, $imageUrl, $userToken);
                } else {
                    $message = $payload['message'] ?? '';
                    $images = $payload['images'] ?? [];
                    $pageId = $payload['pageId'] ?? null;
                    $threadsId = $payload['threadsId'] ?? null;

                    $messageFb = $platform === 'facebook' ? $message : ($platform ? '' : $message);
                    $messageIg = $platform === 'instagram' ? $message : ($platform ? '' : $message);
                    $messageThreads = $platform === 'threads' ? $message : ($platform ? '' : $message);

                    $response = $this->metaService->publish(
                        $messageFb,
                        $messageIg,
                        $images,
                        $pageId,
                        $igId,
                        $userToken,
                        null,
                        $post->user_id,
                        true,
                        $messageThreads,
                        $threadsId
                    );
                }

                $this->db->table('framio_social_queue')
                    ->where('id', $post->id)
                    ->update([
                        'status' => 'success', 
                        'response_log' => json_encode($response),
                        'updated_at' => Carbon::now('Europe/Istanbul')->toDateTimeString()
                    ]);
                
                $results[] = "ID {$post->id}: Basarili";

            } catch (\Exception $e) {
                $this->db->table('framio_social_queue')
                    ->where('id', $post->id)
                    ->update([
                        'status' => 'failed', 
                        'response_log' => json_encode(['error' => $e->getMessage()]),
                        'updated_at' => Carbon::now('Europe/Istanbul')->toDateTimeString()
                    ]);
                
                $results[] = "ID {$post->id}: Hata - " . $e->getMessage();
            }
        }

        return new JsonResponse([
            'status' => 'calisti',
            'server_time' => $now,
            'processed' => count($posts),
            'log' => $results
        ]);
    }
}