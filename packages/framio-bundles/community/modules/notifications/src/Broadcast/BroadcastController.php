<?php

namespace Framio\Community\Notifications\Broadcast;

use Flarum\Http\RequestUtil;
use Flarum\Post\CommentPost;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Admin paneli: kuyruk listesi, elle gönderme, WhatsApp hazır metni, test mesajı.
 *
 * GET  /framio-broadcast            → son kayıtlar + WhatsApp taslağı
 * POST /framio-broadcast  action=send|test|whatsapp_done|skip|enqueue
 */
class BroadcastController implements RequestHandlerInterface
{
    public function __construct(protected Broadcaster $broadcaster, protected ConnectionInterface $db)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        if ($request->getMethod() === 'GET') {
            return new JsonResponse($this->state());
        }

        $body = (array) $request->getParsedBody();
        $ids = isset($body['ids']) ? array_map('intval', (array) $body['ids']) : null;

        try {
            switch (Arr::get($body, 'action')) {
                case 'send':
                    $result = $this->broadcaster->flush($ids);
                    break;
                case 'test':
                    $result = $this->test((string) Arr::get($body, 'channel', 'telegram'));
                    break;
                case 'whatsapp_done':
                    $this->broadcaster->mark($ids ?: [], 'whatsapp', 'sent');
                    $result = ['ok' => true];
                    break;
                case 'skip':
                    foreach (['telegram', 'whatsapp', 'site'] as $ch) {
                        $this->db->table(Broadcaster::TABLE)->whereIn('id', $ids ?: [])->where($ch . '_status', '!=', 'sent')->update([$ch . '_status' => 'skipped']);
                    }
                    $result = ['ok' => true];
                    break;
                case 'backfill':
                    $result = $this->broadcaster->backfill([
                        'from' => (string) Arr::get($body, 'from', ''),
                        'to' => (string) Arr::get($body, 'to', ''),
                        'tag' => trim((string) Arr::get($body, 'tag', '')),
                        'discussion' => (int) Arr::get($body, 'discussion', 0),
                        'photos_only' => (bool) Arr::get($body, 'photos_only', false),
                        'telegram' => (bool) Arr::get($body, 'telegram', false),
                        'limit' => (int) Arr::get($body, 'limit', 100),
                    ]);
                    break;
                case 'clear_pending':
                    // Bekleyen tüm WhatsApp paketlerini iptal et (yanlış seçim için)
                    $this->db->table(Broadcaster::TABLE)->where('whatsapp_status', 'pending')->update(['whatsapp_status' => 'skipped']);
                    $result = ['ok' => true];
                    break;
                case 'enqueue':
                    // Bir mesajı (ör. eski bir paylaşımı) elle kuyruğa ekle
                    $post = CommentPost::find((int) Arr::get($body, 'post_id'));
                    if (!$post) {
                        return new JsonResponse(['error' => 'Mesaj bulunamadı.'], 404);
                    }
                    $this->broadcaster->enqueue($post);
                    $result = ['ok' => true];
                    break;
                default:
                    return new JsonResponse(['error' => 'Geçersiz işlem.'], 422);
            }
        } catch (\Throwable $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }

        return new JsonResponse(['result' => $result] + $this->state());
    }

    protected function test(string $channel): array
    {
        if ($channel === 'telegram') {
            if (!$this->broadcaster->telegramReady()) {
                throw new \RuntimeException('Telegram etkin değil ya da Bot Token / Chat ID eksik.');
            }
            $post = CommentPost::where('type', 'comment')->whereNull('hidden_at')->orderByDesc('id')->first();
            $this->broadcaster->sendTelegram($post ? [resolve(MessageBuilder::class)->item($post, 'reply')] : []);

            return ['ok' => true];
        }

        $this->broadcaster->sendWhatsAppGateway('✅ Forum bağlantı testi');

        return ['ok' => true];
    }

    protected function state(): array
    {
        $rows = $this->db->table(Broadcaster::TABLE . ' as q')
            ->join('posts as p', 'p.id', '=', 'q.post_id')
            ->join('discussions as d', 'd.id', '=', 'q.discussion_id')
            ->orderByDesc('q.id')
            ->limit(40)
            ->get(['q.*', 'p.number', 'd.title', 'd.slug']);

        $counts = [];
        foreach (['telegram', 'whatsapp', 'site'] as $ch) {
            $counts[$ch] = $this->db->table(Broadcaster::TABLE)->where($ch . '_status', 'pending')->count();
        }

        return [
            'items' => $rows->map(fn ($r) => [
                'id' => (int) $r->id,
                'post_id' => (int) $r->post_id,
                'number' => (int) $r->number,
                'discussion_id' => (int) $r->discussion_id,
                'title' => $r->title,
                'slug' => $r->slug,
                'kind' => $r->kind,
                'telegram' => $r->telegram_status,
                'whatsapp' => $r->whatsapp_status,
                'site' => $r->site_status ?? 'skipped',
                'error' => $r->error,
                'created_at' => $r->created_at,
            ])->all(),
            'pending' => $counts,
            'whatsapp_mode' => $this->broadcaster->whatsappMode(),
            'whatsapp_draft' => $this->broadcaster->whatsappMode() === 'manual' ? $this->broadcaster->whatsappDraft() : null,
            'whatsapp_groups' => $this->broadcaster->whatsappGroups(),
            'tags' => $this->db->table('tags')->whereNull('parent_id')->orderBy('position')->get(['slug', 'name'])->map(fn ($t) => ['slug' => $t->slug, 'name' => $t->name])->all(),
            'send_mode' => $this->broadcaster->sendMode(),
            'batch_size' => $this->broadcaster->batchSize(),
            'telegram_ready' => $this->broadcaster->telegramReady(),
            'site_ready' => $this->broadcaster->siteReady(),
        ];
    }
}
