<?php

namespace Framio\SocialShare\Command;

use Illuminate\Console\Command;
use Illuminate\Database\ConnectionInterface;
use Framio\SocialShare\Services\MetaService;
use Carbon\Carbon;
use Psr\Log\LoggerInterface;

class ProcessQueueCommand extends Command
{
    protected $signature = 'framio:social-share:process';
    protected $description = 'Zamanı gelmiş bekleyen sosyal medya gönderilerini Meta API üzerinden paylaşır.';

    protected MetaService $metaService;
    protected ConnectionInterface $db;
    protected LoggerInterface $logger;

    public function __construct(MetaService $metaService, ConnectionInterface $db, LoggerInterface $logger)
    {
        parent::__construct();
        $this->metaService = $metaService;
        $this->db = $db;
        $this->logger = $logger;
    }

    public function handle(): int
    {
        $now = Carbon::now('Europe/Istanbul')->toDateTimeString();

        $posts = $this->db->table('framio_social_queue')
            ->where('status', 'pending')
            ->where('scheduled_at', '<=', $now)
            ->get();

        if ($posts->isEmpty()) {
            $this->info("[$now] Bekleyen planlanmış gönderi yok.");
            return 0;
        }

        $this->info("[$now] " . count($posts) . " adet gönderi işleniyor...");

        foreach ($posts as $post) {
            $payload = json_decode($post->payload, true);

            $platform = $payload['platform'] ?? null;
            $type = $payload['type'] ?? null;
            $igId = $payload['igId'] ?? null;
            $userToken = $payload['userToken'] ?? null;

            try {
                // Eger Hikaye (Story) ise (Instagram veya Facebook)
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

                $this->info("✓ ID {$post->id} ({$platform}): Başarıyla paylaşıldı.");
                $this->logger->info("[Framio Social Share] Zamanlanmış Gönderi/Hikaye Paylaşıldı: ID {$post->id}");

            } catch (\Exception $e) {
                $this->db->table('framio_social_queue')
                    ->where('id', $post->id)
                    ->update([
                        'status' => 'failed',
                        'response_log' => json_encode(['error' => $e->getMessage()]),
                        'updated_at' => Carbon::now('Europe/Istanbul')->toDateTimeString()
                    ]);

                $this->error("✗ ID {$post->id} ({$platform}): Hata - " . $e->getMessage());
                $this->logger->error("[Framio Social Share] Zamanlanmış Gönderi/Hikaye Hatası: ID {$post->id} - " . $e->getMessage());
            }
        }

        return 0;
    }
}
