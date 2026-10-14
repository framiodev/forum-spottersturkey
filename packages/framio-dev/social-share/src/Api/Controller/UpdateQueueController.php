<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Illuminate\Database\ConnectionInterface;
use Framio\SocialShare\Services\MetaService;

class UpdateQueueController implements RequestHandlerInterface
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
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        $body = $request->getParsedBody();
        $id = $body['id'] ?? null;
        $groupId = $body['group_id'] ?? null;
        $action = $body['action'] ?? null;
        $newMessage = $body['message'] ?? null;
        $messagesMap = $body['messages'] ?? null; // [ 'facebook' => '...', 'instagram' => '...', 'threads' => '...', 'instagram_story' => '...' ]
        $newImages = $body['images'] ?? null;
        $newScheduledAt = $body['scheduled_at'] ?? null;

        if (!$id && !$groupId) return new JsonResponse(['error' => 'ID veya Group ID gerekli'], 400);

        // Hedef kayıtları belirle
        $records = [];
        if ($groupId) {
            $allPending = $this->db->table('framio_social_queue')->get();
            foreach ($allPending as $item) {
                $p = json_decode($item->payload, true);
                if (isset($p['group_id']) && $p['group_id'] === $groupId) {
                    $records[] = $item;
                }
            }
        }
        if (empty($records) && $id) {
            $record = $this->db->table('framio_social_queue')->find($id);
            if ($record) $records[] = $record;
        }

        if (empty($records)) return new JsonResponse(['error' => 'Kayıt bulunamadı'], 404);

        if ($action === 'delete') {
            $deleteCount = 0;
            foreach ($records as $rec) {
                $this->db->table('framio_social_queue')->delete($rec->id);
                $deleteCount++;
            }
            return new JsonResponse(['status' => 'deleted', 'message' => "{$deleteCount} platform kaydı kuyruktan başarıyla silindi."]);
        }

        if ($action === 'update') {
            $updatedCount = 0;
            foreach ($records as $rec) {
                $payload = json_decode($rec->payload, true);
                $platform = $payload['platform'] ?? null;

                if ($messagesMap && is_array($messagesMap) && $platform && isset($messagesMap[$platform])) {
                    $payload['message'] = $messagesMap[$platform];
                } elseif ($newMessage) {
                    $payload['message'] = $newMessage;
                }

                if ($newImages && is_array($newImages)) {
                    $payload['images'] = $newImages;
                    if ($platform === 'instagram_story' || ($payload['type'] ?? '') === 'story') {
                        $payload['image_url'] = $newImages[0] ?? ($payload['image_url'] ?? null);
                    }
                }

                $updateData = [
                    'payload' => json_encode($payload),
                    'updated_at' => date('Y-m-d H:i:s')
                ];

                if ($newScheduledAt) {
                    $updateData['scheduled_at'] = $newScheduledAt;
                }

                $this->db->table('framio_social_queue')->where('id', $rec->id)->update($updateData);
                $updatedCount++;
            }

            return new JsonResponse(['status' => 'updated', 'message' => "Planlanmış gönderi ({$updatedCount} platform) başarıyla güncellendi!"]);
        }

        return new JsonResponse(['error' => 'Geçersiz işlem'], 400);
    }
}