<?php

namespace Framio\Community\Notifications\Broadcast;

use Carbon\Carbon;
use Flarum\Post\CommentPost;
use Flarum\Notification\NotificationSyncer;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Flarum\User\Guest;
use GuzzleHttp\Client;
use Illuminate\Database\ConnectionInterface;
use Psr\Log\LoggerInterface;

/**
 * Forum mesajlarını Telegram / WhatsApp gruplarına duyurur.
 *
 * Akış: yeni mesaj kuyruğa yazılır (mesaj gönderimi beklemez) → gönderim modu
 * "anında" ya da "her N mesajda" ise yanıt kullanıcıya döndükten sonra gönderilir;
 * "elle" modunda admin panelinden gönderilir.
 *
 * WhatsApp: "manual" modunda mesaj panelde hazır metin olarak bekler (gruba tek tıkla
 * yapıştırılır); "gateway" modunda barındırılan bir WhatsApp API servisine gönderilir.
 */
class Broadcaster
{
    public const TABLE = 'framio_broadcast_queue';

    protected static bool $flushScheduled = false;

    public function __construct(
        protected ConnectionInterface $db,
        protected SettingsRepositoryInterface $settings,
        protected MessageBuilder $builder,
        protected LoggerInterface $logger
    ) {
    }

    public function setting(string $key, $default = null)
    {
        $value = $this->settings->get('notifications.' . $key);

        return ($value === null || $value === '') ? $default : $value;
    }

    public function telegramReady(): bool
    {
        return (bool) $this->setting('telegram_enabled') && $this->setting('telegram_bot_token') && $this->setting('telegram_chat_id');
    }

    /** Site bildirimi (site içi + tarayıcı/PWA + e-posta, üyenin tercihlerine göre) */
    public function siteReady(): bool
    {
        return (bool) $this->setting('site_notify', '1');
    }

    public function whatsappMode(): string
    {
        $mode = (string) $this->setting('whatsapp_mode', $this->setting('whatsapp_enabled') ? 'manual' : 'off');

        return in_array($mode, ['off', 'manual', 'gateway'], true) ? $mode : 'off';
    }

    public function sendMode(): string
    {
        $mode = (string) $this->setting('send_mode', 'batch');

        return in_array($mode, ['instant', 'batch', 'manual'], true) ? $mode : 'batch';
    }

    public function batchSize(): int
    {
        return max(1, min(10, (int) $this->setting('batch_size', 5)));
    }

    /** Yeni mesajı kuyruğa ekler; yalnızca ziyaretçinin görebildiği yorum mesajları */
    public function enqueue(CommentPost $post): void
    {
        if (!$this->telegramReady() && $this->whatsappMode() === 'off' && !$this->siteReady()) {
            return;
        }
        if ($post->type !== 'comment' || $post->hidden_at || !$post->discussion) {
            return;
        }
        // Gizli / kısıtlı etiketler ve özel tartışmalar: misafir göremiyorsa gruba da gitmez
        $visible = CommentPost::whereVisibleTo(new Guest())->where('id', $post->id)->exists();
        if (!$visible) {
            return;
        }

        $this->db->table(self::TABLE)->insertOrIgnore([
            'post_id' => $post->id,
            'discussion_id' => $post->discussion_id,
            'kind' => $post->number === 1 ? 'discussion' : 'reply',
            'telegram_status' => $this->telegramReady() ? 'pending' : 'skipped',
            'whatsapp_status' => $this->whatsappMode() === 'off' ? 'skipped' : 'pending',
            'site_status' => $this->siteReady() ? 'pending' : 'skipped',
            'created_at' => Carbon::now(),
        ]);

        $this->scheduleAutoFlush();
    }

    /**
     * Eski mesajları kuyruğa ekler (geçmiş arşivi gruplara taşımak için).
     * Site bildirimi gönderilmez: üyelere eski içerik için toplu bildirim gitmesin.
     *
     * @param array{from?:string, to?:string, tag?:string, discussion?:int, photos_only?:bool, telegram?:bool, limit?:int} $filter
     * @return array{added:int, matched:int}
     */
    public function backfill(array $filter): array
    {
        $q = CommentPost::whereVisibleTo(new Guest())
            ->where('posts.type', 'comment')
            ->whereNull('posts.hidden_at')
            ->whereNotIn('posts.id', fn ($sub) => $sub->select('post_id')->from(self::TABLE));

        if (!empty($filter['from'])) {
            $q->where('posts.created_at', '>=', Carbon::parse($filter['from'])->startOfDay());
        }
        if (!empty($filter['to'])) {
            $q->where('posts.created_at', '<=', Carbon::parse($filter['to'])->endOfDay());
        }
        if (!empty($filter['discussion'])) {
            $q->where('posts.discussion_id', (int) $filter['discussion']);
        }
        if (!empty($filter['tag'])) {
            $tagIds = $this->db->table('tags')->where('slug', $filter['tag'])->orWhere('parent_id', function ($sub) use ($filter) {
                $sub->select('id')->from('tags')->where('slug', $filter['tag']);
            })->pluck('id')->all();
            $q->whereIn('posts.discussion_id', fn ($sub) => $sub->select('discussion_id')->from('discussion_tag')->whereIn('tag_id', $tagIds ?: [0]));
        }
        if (!empty($filter['photos_only'])) {
            // Medya etiketi ya da Markdown resmi içeren mesajlar
            $q->where(fn ($w) => $w->where('posts.content', 'like', '%url=%')->orWhere('posts.content', 'like', '%<IMG %'));
        }

        $limit = max(1, min(500, (int) ($filter['limit'] ?? 100)));
        $matched = (clone $q)->count();
        $posts = $q->orderBy('posts.created_at')->limit($limit)->get(['posts.id', 'posts.discussion_id', 'posts.number']);

        $telegram = !empty($filter['telegram']) && $this->telegramReady();
        $rows = [];
        foreach ($posts as $post) {
            $rows[] = [
                'post_id' => $post->id,
                'discussion_id' => $post->discussion_id,
                'kind' => $post->number === 1 ? 'discussion' : 'reply',
                'telegram_status' => $telegram ? 'pending' : 'skipped',
                'whatsapp_status' => $this->whatsappMode() === 'off' ? 'skipped' : 'pending',
                'site_status' => 'skipped',
                'created_at' => Carbon::now(),
            ];
        }
        foreach (array_chunk($rows, 200) as $chunk) {
            $this->db->table(self::TABLE)->insertOrIgnore($chunk);
        }

        return ['added' => count($rows), 'matched' => $matched];
    }

    /** @return array<int, array{name:string, link:string}> Admin'de tanımlı WhatsApp grupları ("Ad | davet bağlantısı") */
    public function whatsappGroups(): array
    {
        $groups = [];
        foreach (preg_split('/\R/', (string) $this->setting('whatsapp_groups', '')) as $line) {
            $parts = array_map('trim', explode('|', $line, 2));
            if ($parts[0] === '') continue;
            $link = $parts[1] ?? '';
            $groups[] = ['name' => $parts[0], 'link' => preg_match('#^https://(chat\.whatsapp\.com|whatsapp\.com|wa\.me)/#i', $link) ? $link : ''];
        }

        return $groups;
    }

    /** Anında / toplu modda gönderimi, yanıt kullanıcıya gittikten sonra yap */
    protected function scheduleAutoFlush(): void
    {
        if ($this->sendMode() === 'manual' || self::$flushScheduled) {
            return;
        }
        $threshold = $this->sendMode() === 'instant' ? 1 : $this->batchSize();
        $pending = $this->db->table(self::TABLE)->where('telegram_status', 'pending')->count();
        $pendingWa = $this->whatsappMode() === 'gateway' ? $this->db->table(self::TABLE)->where('whatsapp_status', 'pending')->count() : 0;
        $pendingSite = $this->siteReady() ? $this->db->table(self::TABLE)->where('site_status', 'pending')->count() : 0;
        if ($pending < $threshold && $pendingWa < $threshold && $pendingSite < $threshold) {
            return;
        }

        self::$flushScheduled = true;
        register_shutdown_function(function () {
            if (function_exists('fastcgi_finish_request')) {
                @fastcgi_finish_request();
            } elseif (function_exists('litespeed_finish_request')) {
                @litespeed_finish_request();
            }
            @ignore_user_abort(true);
            @set_time_limit(120);
            try {
                $this->flush();
            } catch (\Throwable $e) {
                $this->logger->warning('[broadcast] ' . $e->getMessage());
            }
        });
    }

    /**
     * Bekleyenleri gönderir. @param int[]|null $ids yalnızca bu kuyruk kayıtları
     * @return array{telegram:int, whatsapp:int, errors:string[]}
     */
    public function flush(?array $ids = null): array
    {
        $result = ['telegram' => 0, 'whatsapp' => 0, 'site' => 0, 'errors' => []];

        if ($this->telegramReady()) {
            $rows = $this->pendingRows('telegram_status', $ids);
            foreach (array_chunk($rows, $this->sendMode() === 'instant' && $ids === null ? 1 : $this->batchSize()) as $chunk) {
                $items = $this->items($chunk);
                if (!$items) continue;
                try {
                    $this->sendTelegram($items);
                    $this->mark(array_column($chunk, 'id'), 'telegram', 'sent');
                    $result['telegram'] += count($chunk);
                } catch (\Throwable $e) {
                    $this->mark(array_column($chunk, 'id'), 'telegram', 'failed', $e->getMessage());
                    $result['errors'][] = 'Telegram: ' . $e->getMessage();
                }
            }
        }

        if ($this->whatsappMode() === 'gateway') {
            $rows = $this->pendingRows('whatsapp_status', $ids);
            foreach (array_chunk($rows, $this->batchSize()) as $chunk) {
                $items = $this->items($chunk);
                if (!$items) continue;
                try {
                    $this->sendWhatsAppGateway($this->builder->whatsapp($items));
                    $this->mark(array_column($chunk, 'id'), 'whatsapp', 'sent');
                    $result['whatsapp'] += count($chunk);
                } catch (\Throwable $e) {
                    $this->mark(array_column($chunk, 'id'), 'whatsapp', 'failed', $e->getMessage());
                    $result['errors'][] = 'WhatsApp: ' . $e->getMessage();
                }
            }
        }

        if ($this->siteReady()) {
            $rows = $this->pendingRows('site_status', $ids);
            foreach (array_chunk($rows, $this->sendMode() === 'instant' && $ids === null ? 1 : $this->batchSize()) as $chunk) {
                try {
                    $this->notifySite($chunk);
                    $this->mark(array_column($chunk, 'id'), 'site', 'sent');
                    $result['site'] += count($chunk);
                } catch (\Throwable $e) {
                    $this->mark(array_column($chunk, 'id'), 'site', 'failed', $e->getMessage());
                    $result['errors'][] = 'Site bildirimi: ' . $e->getMessage();
                }
            }
        }

        return $result;
    }

    /**
     * Gruplara giden duyurunun aynısını üyelere site bildirimi olarak gönderir.
     * Mesajların yazarları ve tartışmayı zaten takip edenler (onlara abonelik
     * bildirimi gidiyor) hariç tutulur; aynı içerik için iki bildirim gitmez.
     */
    protected function notifySite(array $chunk): void
    {
        $posts = CommentPost::with('discussion')->whereIn('id', array_column($chunk, 'post_id'))->orderBy('id')->get();
        $first = $posts->first();
        if (!$first) {
            return;
        }

        $authorIds = $posts->pluck('user_id')->filter()->all();
        $followers = $this->db->table('discussion_user')
            ->whereIn('discussion_id', $posts->pluck('discussion_id')->unique()->all())
            ->where('subscription', 'follow')
            ->pluck('user_id')->all();

        $users = User::query()
            ->where('is_email_confirmed', true)
            ->whereNotIn('id', array_values(array_unique(array_merge($authorIds, $followers))) ?: [0])
            ->where(fn ($q) => $q->whereNull('suspended_until')->orWhere('suspended_until', '<', Carbon::now()))
            ->get()
            ->all();

        $item = $this->builder->item($first, 'reply');
        $label = $item['lines'][0] ?? (string) $first->discussion->title;

        resolve(NotificationSyncer::class)->sync(new HighlightBlueprint($first, count($posts), $label), $users);
    }

    /** WhatsApp elle modu: bekleyenlerin hazır metni (gruplara kopyalanır) */
    public function whatsappDraft(?array $ids = null): array
    {
        // Paket büyüklüğü toplu gönderim sayısı kadar: WhatsApp'a aralıklı, okunur paketler
        $rows = $this->pendingRows('whatsapp_status', $ids, $this->batchSize());
        $items = $this->items($rows);

        return ['ids' => array_column($rows, 'id'), 'text' => $items ? $this->builder->whatsapp($items) : ''];
    }

    public function mark(array $ids, string $channel, string $status, ?string $error = null): void
    {
        if (!$ids) return;
        $update = [$channel . '_status' => $status];
        if ($status === 'sent') {
            $update[$channel . '_sent_at'] = Carbon::now();
        }
        if ($error !== null) {
            $update['error'] = mb_substr($error, 0, 1000);
        }
        $this->db->table(self::TABLE)->whereIn('id', $ids)->update($update);
    }

    protected function pendingRows(string $column, ?array $ids, int $limit = 50): array
    {
        $q = $this->db->table(self::TABLE)->whereIn($column, $ids === null ? ['pending'] : ['pending', 'failed'])->orderBy('id')->limit($limit);
        if ($ids !== null) {
            $q->whereIn('id', array_map('intval', $ids));
        }

        return array_map(fn ($r) => (array) $r, $q->get()->all());
    }

    protected function items(array $rows): array
    {
        $posts = CommentPost::with(['discussion', 'user'])->whereIn('id', array_column($rows, 'post_id'))->get()->keyBy('id');
        $items = [];
        foreach ($rows as $row) {
            if ($post = $posts->get($row['post_id'])) {
                $items[] = $this->builder->item($post, $row['kind']);
            }
        }

        return $items;
    }

    // ── TELEGRAM ────────────────────────────────────────────────────────────

    public function sendTelegram(array $items): void
    {
        $text = $this->builder->telegram($items);
        $photos = [];
        foreach ($items as $it) {
            if ($this->setting('include_photos', '1') && $it['image']) {
                $photos[] = $it['image'];
            }
        }
        $photos = array_slice($photos, 0, 10);

        foreach ($this->telegramChats() as $chat) {
            $base = ['chat_id' => $chat];
            if ($thread = $this->setting('telegram_thread_id')) {
                $base['message_thread_id'] = (int) $thread;
            }

            if (count($photos) === 1 && mb_strlen($text) <= 1000) {
                $this->telegram('sendPhoto', $base + ['photo' => $photos[0], 'caption' => $text, 'parse_mode' => 'HTML']);
            } elseif (count($photos) > 1) {
                // Albüm: açıklama ilk fotoğrafta (1024 karakter sınırı)
                $media = [];
                foreach ($photos as $i => $p) {
                    $media[] = ['type' => 'photo', 'media' => $p] + ($i === 0 && mb_strlen($text) <= 1000 ? ['caption' => $text, 'parse_mode' => 'HTML'] : []);
                }
                $this->telegram('sendMediaGroup', $base + ['media' => json_encode($media)]);
                if (mb_strlen($text) > 1000) {
                    $this->telegram('sendMessage', $base + ['text' => $text, 'parse_mode' => 'HTML', 'disable_web_page_preview' => true]);
                }
            } else {
                $this->telegram('sendMessage', $base + ['text' => $text, 'parse_mode' => 'HTML']);
            }
        }
    }

    /** @return string[] Virgülle ayrılmış birden çok grup/kanal kimliği */
    protected function telegramChats(): array
    {
        return array_values(array_filter(array_map('trim', explode(',', (string) $this->setting('telegram_chat_id', '')))));
    }

    public function telegram(string $method, array $params): array
    {
        $token = trim((string) $this->setting('telegram_bot_token'));
        $response = (new Client(['timeout' => 20, 'http_errors' => false]))
            ->post("https://api.telegram.org/bot{$token}/{$method}", ['form_params' => $params]);
        $body = json_decode((string) $response->getBody(), true);
        if (!is_array($body) || empty($body['ok'])) {
            throw new \RuntimeException(is_array($body) ? (string) ($body['description'] ?? 'Bilinmeyen hata') : 'HTTP ' . $response->getStatusCode());
        }

        return $body;
    }

    // ── WHATSAPP (barındırılan API servisi) ─────────────────────────────────

    public function sendWhatsAppGateway(string $text): void
    {
        $url = trim((string) $this->setting('whatsapp_gateway_url'));
        $group = trim((string) $this->setting('whatsapp_group_id'));
        if ($url === '' || $group === '') {
            throw new \RuntimeException('WhatsApp API adresi veya grup kimliği girilmemiş.');
        }

        $headers = ['Accept' => 'application/json'];
        if ($token = trim((string) $this->setting('whatsapp_gateway_token'))) {
            $headers['Authorization'] = 'Bearer ' . $token;
        }

        // Servisler farklı alan adları bekliyor: yaygın olanların hepsi gönderilir
        $response = (new Client(['timeout' => 20, 'http_errors' => false]))->post($url, [
            'headers' => $headers,
            'json' => ['to' => $group, 'chatId' => $group, 'groupId' => $group, 'body' => $text, 'text' => $text, 'message' => $text],
        ]);
        if ($response->getStatusCode() >= 300) {
            throw new \RuntimeException('HTTP ' . $response->getStatusCode() . ': ' . mb_substr((string) $response->getBody(), 0, 300));
        }
    }
}
