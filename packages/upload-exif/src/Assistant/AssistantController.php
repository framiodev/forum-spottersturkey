<?php

namespace Framio\UploadExif\Assistant;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Framio Asistan:
 *   POST /framio-assistant/parse  {text}                       → komutun anlamı (plaka, adet, işlem)
 *   POST /framio-assistant/route  {brand, model, company}      → başlık önerileri (öğrenilen önce)
 *   POST /framio-assistant/learn  {brand, model, company, discussion_id} → onaylanan paylaşımı öğren
 *   POST /framio-assistant/forget                              → öğrenilenleri sıfırla
 */
class AssistantController implements RequestHandlerInterface
{
    public function __construct(protected ConnectionInterface $db, protected SettingsRepositoryInterface $settings, protected Era $era)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();
        $body = (array) ($request->getParsedBody() ?: []);
        $path = $request->getUri()->getPath();

        return match (true) {
            str_ends_with($path, '/parse') => new JsonResponse($this->parse((string) Arr::get($body, 'text', ''))),
            str_ends_with($path, '/route') => new JsonResponse($this->route($actor, $body)),
            str_ends_with($path, '/learn') => new JsonResponse($this->learn($actor, $body)),
            str_ends_with($path, '/forget') => new JsonResponse($this->forget($actor)),
            str_ends_with($path, '/history') && $request->getMethod() === 'GET' => new JsonResponse($this->history($actor, (int) Arr::get($request->getQueryParams(), 'limit', 60), (bool) Arr::get($request->getQueryParams(), 'mark'))),
            str_ends_with($path, '/history') && $request->getMethod() === 'DELETE' => new JsonResponse($this->clearHistory($actor)),
            str_ends_with($path, '/history') => new JsonResponse($this->remember($actor, $body)),
            str_ends_with($path, '/schedule') && $request->getMethod() === 'GET' => new JsonResponse($this->schedule($actor)),
            str_ends_with($path, '/schedule') => new JsonResponse($this->plan($actor, $body)),
            str_ends_with($path, '/schedule/cancel') => new JsonResponse($this->cancel($actor, $body)),
            str_ends_with($path, '/seen') => new JsonResponse($this->seen($actor, (array) Arr::get($body, 'names', []))),
            default => new JsonResponse(['error' => 'Bilinmeyen işlem'], 404),
        };
    }

    /** Öğrenmenin otomatiğe geçtiği onay sayısı (admin ayarı, varsayılan 3) */
    protected function autoAfter(): int
    {
        return max(2, (int) ($this->settings->get('framio-upload-exif.assistant_auto_after') ?: 3));
    }

    // ── Komutu anlama (kural tabanlı: hızlı, ücretsiz, Türkçe) ─────────────────

    public function parse(string $text): array
    {
        $raw = trim($text);
        $t = mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], $raw), 'UTF-8');

        $words = ['sıfır' => 0, 'bir' => 1, 'iki' => 2, 'üç' => 3, 'dört' => 4, 'beş' => 5, 'altı' => 6, 'yedi' => 7, 'sekiz' => 8, 'dokuz' => 9, 'on' => 10];

        // Plaka: "06 ABC 123", "06abc123", "06 A B C 123"
        $plate = null;
        $up = mb_strtoupper(str_replace(['i', 'ı'], ['İ', 'I'], $raw), 'UTF-8');
        if (preg_match('/\b(\d{2})\s*((?:[A-ZÇĞİÖŞÜ]\s*){1,3})\s*(\d{2,5})\b/u', $up, $m)) {
            $plate = $m[1] . ' ' . preg_replace('/\s+/u', '', $m[2]) . ' ' . $m[3];
        }

        // Adet: "3 fotoğraf", "son üç", "hepsini"
        $count = null;
        if (preg_match('/\b(\d{1,2})\s*(?:tane|adet|fotoğraf|foto|görsel|resim)/u', $t, $m)) {
            $count = (int) $m[1];
        } elseif (preg_match('/\b(' . implode('|', array_keys($words)) . ')\s*(?:tane|adet|fotoğraf|foto|görsel|resim)/u', $t, $m)) {
            $count = $words[$m[1]];
        }
        if (preg_match('/\b(hepsi|hepsini|tümü|tümünü|bütün)/u', $t)) {
            $count = 0; // hepsi
        }

        $action = 'search';
        if (preg_match('/(paylaş|gönder|yükle|yolla|post|at\b|ekle)/u', $t)) $action = 'share';
        if (preg_match('/(iptal|vazgeç|dur\b|durdur|kapat)/u', $t)) $action = 'cancel';
        if (preg_match('/^(evet|tamam|olur|onayla|paylaş|gönder)\b/u', $t) && !$plate) $action = 'confirm';
        if (preg_match('/^(hayır|yok|istemiyorum)\b/u', $t)) $action = 'cancel';
        if (preg_match('/(klasör|klasörü)\s*(bağla|seç|değiştir)/u', $t)) $action = 'folder';
        if (preg_match('/(yardım|neler yapabilirsin|ne yapabilirsin)/u', $t)) $action = 'help';

        // Bölüm ipucu: "şehiriçi", "şehirlerarası", "turizm" vb.
        $tag = null;
        foreach ($this->db->table('tags')->whereNull('parent_id')->get(['slug', 'name']) as $tg) {
            $first = mb_strtolower(Str::before((string) $tg->name, ' '), 'UTF-8');
            if (mb_strlen($first) > 4 && str_contains($t, $first)) {
                $tag = $tg->slug;
                break;
            }
        }

        // Dosya adı araması: plaka yoksa tırnak içindeki ya da "adlı/isimli" sonrası ifade
        $query = $plate;
        if (!$query && preg_match('/["“”\']([^"“”\']{2,60})["“”\']/u', $raw, $m)) $query = trim($m[1]);
        if (!$query && preg_match('/(?:adlı|isimli|içinde)\s+(.{2,60}?)(?:\s+(?:fotoğraf|foto|görsel|dosya)|$)/u', $raw, $m)) $query = trim($m[1]);

        // Planlama: "7 gün boyunca günde 10", "her gün saat 12'de", "2026 çekimlerinden", "Drive'dan"
        $days = preg_match('/(\d{1,2})\s*gün/u', $t, $m) ? (int) $m[1] : null;
        $perDay = preg_match('/günde\s*(\d{1,3})/u', $t, $m) ? (int) $m[1] : null;
        $time = null;
        if (preg_match('/saat\s*(\d{1,2})(?:[:.](\d{2}))?/u', $t, $m)) {
            $time = sprintf('%02d:%02d', min(23, (int) $m[1]), (int) ($m[2] ?? 0));
        } elseif (preg_match('/öğle(?:n|yin)?/u', $t)) {
            $time = '12:00';
        } elseif (preg_match('/akşam/u', $t)) {
            $time = '19:00';
        } elseif (preg_match('/sabah/u', $t)) {
            $time = '09:00';
        }
        $shotYear = preg_match('/\b(19\d{2}|20\d{2})\s*(?:çekim|yılı|yılında|tarihli)/u', $t, $m) ? (int) $m[1] : null;
        $source = str_contains($t, 'drive') ? 'drive' : (preg_match('/(klasör|masaüstü|bilgisayar)/u', $t) ? 'local' : null);
        if (preg_match('/(\d{1,3})\s*(?:farklı)?\s*(?:poz|fotoğraf|foto|görsel)/u', $t, $m)) $count = (int) $m[1];
        $diverse = (bool) preg_match('/farklı/u', $t);
        $notify = (bool) preg_match('/(haber ver|bildir|söyle)/u', $t);
        $today = (bool) preg_match('/\bbugün/u', $t);

        if ($action === 'share' && !$plate && ($count > 1 || $count === 0 || $days || $perDay || $time || $shotYear || preg_match('/(planla|zamanla|her gün|yeni fotoğraf)/u', $t))) {
            $action = $days || $perDay || $time || preg_match('/(planla|zamanla|her gün)/u', $t) ? 'plan' : 'batch';
        }
        if (preg_match('/(planla|zamanla)/u', $t) && $action === 'search') $action = 'plan';
        if (preg_match('/(planlarım|planlanan|zamanlanmış|sıradaki paylaşım)/u', $t)) $action = 'schedule_list';
        if (preg_match('/(planı|planları|zamanlanmışları)\s*(iptal|sil|durdur)/u', $t)) $action = 'schedule_cancel';

        return ['action' => $action, 'plate' => $plate, 'query' => $query, 'count' => $count, 'tag' => $tag, 'text' => $raw,
            'days' => $days, 'per_day' => $perDay, 'time' => $time, 'shot_year' => $shotYear, 'source' => $source,
            'diverse' => $diverse, 'notify' => $notify, 'today' => $today];
    }

    // ── Başlık önerisi ───────────────────────────────────────────────────────

    protected function keys(array $body): array
    {
        $brand = trim((string) Arr::get($body, 'brand', ''));
        $model = trim((string) Arr::get($body, 'model', ''));
        $company = trim((string) Arr::get($body, 'company', ''));
        $keys = [];
        if ($brand && $model) $keys[] = 'model:' . Str::slug($brand . ' ' . $model);
        if ($brand) $keys[] = 'brand:' . Str::slug($brand);
        if ($company) $keys[] = 'company:' . Str::slug($company);

        return array_values(array_filter($keys, fn ($k) => !str_ends_with($k, ':')));
    }

    protected function describe(int $discussionId, User $actor): ?array
    {
        $d = Discussion::whereVisibleTo($actor)->find($discussionId);
        if (!$d || $d->is_locked || $d->hidden_at) return null;
        if (!$actor->can('reply', $d)) return null;

        return ['discussion_id' => (int) $d->id, 'title' => (string) $d->title, 'url' => '/d/' . $d->id . '-' . $d->slug];
    }

    public function route(User $actor, array $body): array
    {
        $out = [];
        $auto = false;

        // 1) Kullanıcının öğrendikleri (en özelden genele: model → marka → firma)
        $wantEra = $this->era->enabled() ? $this->era->forYear((int) Arr::get($body, 'year') ?: null) : null;
        foreach ($this->keys($body) as $key) {
            if ($wantEra) $key .= '@' . $wantEra;
            $r = $this->db->table('framio_assistant_routes')->where('user_id', $actor->id)->where('route_key', $key)->first();
            if ($r && ($d = $this->describe((int) $r->discussion_id, $actor))) {
                $learned = (int) $r->hits >= $this->autoAfter() && str_starts_with($key, 'model:');
                $out[] = $d + ['reason' => $learned ? 'learned' : 'history', 'hits' => (int) $r->hits];
                $auto = $auto || $learned;
                break;
            }
        }

        // 2) Forum: bu model/marka fotoğraflarının en çok paylaşıldığı başlıklar
        if ($this->db->getSchemaBuilder()->hasTable('framio_seo_entities')) {
            $brand = trim((string) Arr::get($body, 'brand', ''));
            $model = trim((string) Arr::get($body, 'model', ''));
            foreach ([['model', $brand && $model ? Str::slug($brand . ' ' . $model) : null], ['brand', $brand ? Str::slug($brand) : null]] as [$type, $slug]) {
                if (!$slug) continue;
                $rows = $this->db->table('framio_seo_entities')->where('type', $type)->where('slug', $slug)
                    ->groupBy('discussion_id')->selectRaw('discussion_id, COUNT(DISTINCT post_id) as n')
                    ->orderByDesc('n')->limit(5)->get();
                foreach ($rows as $row) {
                    if (collect($out)->contains('discussion_id', (int) $row->discussion_id)) continue;
                    if ($d = $this->describe((int) $row->discussion_id, $actor)) {
                        $out[] = $d + ['reason' => $type, 'count' => (int) $row->n];
                    }
                }
                if (count($out) >= 4) break;
            }
        }

        // Güncel / Arşiv: çekim yılına göre doğru döneme ait aynı adlı başlık kullanılır
        $want = $this->era->forYear((int) Arr::get($body, 'year') ?: null);
        if ($want && $this->era->enabled()) {
            $fixed = [];
            foreach ($out as $sug) {
                $era = $this->era->ofDiscussion($sug['discussion_id']);
                if ($era && $era !== $want) {
                    $mirror = $this->era->mirror($sug['discussion_id'], $want);
                    $sug = $mirror && ($d = $this->describe($mirror, $actor)) ? $d + ['reason' => $sug['reason'], 'era_moved' => true] : null;
                    if ($sug && $sug['reason'] === 'learned') $auto = $auto && true;
                }
                if ($sug && !collect($fixed)->contains('discussion_id', $sug['discussion_id'])) {
                    $sug['era'] = $want;
                    $fixed[] = $sug;
                }
            }
            $out = $fixed;
            if (!$out) $auto = false;
        }

        return ['suggestions' => array_slice($out, 0, 5), 'auto' => $auto, 'auto_after' => $this->autoAfter(), 'era' => $want];
    }

    // ── Öğrenme ──────────────────────────────────────────────────────────────

    public function learn(User $actor, array $body): array
    {
        $discussionId = (int) Arr::get($body, 'discussion_id');
        if (!$discussionId || !$this->describe($discussionId, $actor)) {
            return ['ok' => false];
        }
        foreach ($this->keys($body) as $key) {
            // Güncel ve Arşiv için ayrı öğrenilir
            if ($e = $this->era->ofDiscussion($discussionId)) $key .= '@' . $e;
            $r = $this->db->table('framio_assistant_routes')->where('user_id', $actor->id)->where('route_key', $key)->first();
            if ($r && (int) $r->discussion_id === $discussionId) {
                $this->db->table('framio_assistant_routes')->where('id', $r->id)->update(['hits' => $r->hits + 1, 'updated_at' => Carbon::now()]);
            } elseif ($r) {
                // Farklı başlık seçildi: öğrenme baştan başlar (yanlış otomatikleşme olmasın)
                $this->db->table('framio_assistant_routes')->where('id', $r->id)->update(['discussion_id' => $discussionId, 'hits' => 1, 'updated_at' => Carbon::now()]);
            } else {
                $this->db->table('framio_assistant_routes')->insert(['user_id' => $actor->id, 'route_key' => $key, 'discussion_id' => $discussionId, 'hits' => 1, 'updated_at' => Carbon::now()]);
            }
        }

        return ['ok' => true];
    }

    // ── Sohbet geçmişi ───────────────────────────────────────────────────────

    public function history(User $actor, int $limit, bool $mark = false): array
    {
        $limit = max(10, min(200, $limit));
        $rows = $this->db->table('framio_assistant_messages')->where('user_id', $actor->id)->orderByDesc('id')->limit($limit)->get(['id', 'role', 'text', 'seen', 'created_at'])->reverse()->values();
        $unseen = $this->db->table('framio_assistant_messages')->where('user_id', $actor->id)->where('seen', false)->count();
        // Görüntülenen bildirimler okundu sayılır
        if ($mark) {
            $this->db->table('framio_assistant_messages')->where('user_id', $actor->id)->where('seen', false)->update(['seen' => true]);
        }

        return ['messages' => $rows->map(fn ($r) => ['id' => (int) $r->id, 'role' => $r->role, 'text' => $r->text, 'seen' => (bool) $r->seen, 'at' => $r->created_at])->all(), 'unseen' => $unseen];
    }

    public function remember(User $actor, array $body): array
    {
        $role = in_array(Arr::get($body, 'role'), ['me', 'bot'], true) ? Arr::get($body, 'role') : 'bot';
        $text = mb_substr(trim((string) Arr::get($body, 'text', '')), 0, 2000);
        if ($text === '') return ['ok' => false];
        $this->db->table('framio_assistant_messages')->insert(['user_id' => $actor->id, 'role' => $role, 'text' => $text, 'seen' => true, 'created_at' => Carbon::now()]);
        // Geçmiş sınırsız büyümesin: son 500 mesaj tutulur
        $keep = $this->db->table('framio_assistant_messages')->where('user_id', $actor->id)->orderByDesc('id')->skip(500)->value('id');
        if ($keep) $this->db->table('framio_assistant_messages')->where('user_id', $actor->id)->where('id', '<=', $keep)->delete();

        return ['ok' => true];
    }

    public function clearHistory(User $actor): array
    {
        return ['ok' => true, 'removed' => $this->db->table('framio_assistant_messages')->where('user_id', $actor->id)->delete()];
    }

    // ── Planlı paylaşımlar ───────────────────────────────────────────────────

    public function schedule(User $actor): array
    {
        $rows = $this->db->table('framio_assistant_schedule')->where('user_id', $actor->id)->where('status', 'pending')->orderBy('publish_at')->limit(300)->get();
        $byDay = [];
        foreach ($rows as $r) {
            $day = Carbon::parse($r->publish_at)->timezone($this->tz())->format('d.m.Y H:i');
            $byDay[$day] = ($byDay[$day] ?? 0) + 1;
        }

        return ['pending' => count($rows), 'slots' => $byDay];
    }

    protected function tz(): string
    {
        return (string) ($this->settings->get('framio-custom-homepage.explore_timezone') ?: 'Europe/Istanbul');
    }

    /** items: [{discussion_id, content, label, publish_at (ISO, yerel saat)}] */
    public function plan(User $actor, array $body): array
    {
        $items = (array) Arr::get($body, 'items', []);
        $planId = substr(sha1($actor->id . microtime()), 0, 12);
        $n = 0;
        foreach (array_slice($items, 0, 500) as $it) {
            $did = (int) ($it['discussion_id'] ?? 0);
            $content = trim((string) ($it['content'] ?? ''));
            if (!$did || $content === '' || !$this->describe($did, $actor)) continue;
            try {
                $at = Carbon::parse((string) ($it['publish_at'] ?? ''), $this->tz())->utc();
            } catch (\Throwable $e) {
                continue;
            }
            $this->db->table('framio_assistant_schedule')->insert([
                'user_id' => $actor->id, 'plan' => $planId, 'discussion_id' => $did, 'content' => $content,
                'label' => mb_substr((string) ($it['label'] ?? ''), 0, 190), 'publish_at' => $at, 'status' => 'pending', 'created_at' => Carbon::now(),
            ]);
            $n++;
        }

        return ['ok' => $n > 0, 'plan' => $planId, 'count' => $n] + $this->schedule($actor);
    }

    public function cancel(User $actor, array $body): array
    {
        $q = $this->db->table('framio_assistant_schedule')->where('user_id', $actor->id)->where('status', 'pending');
        if ($plan = Arr::get($body, 'plan')) $q->where('plan', $plan);

        return ['ok' => true, 'cancelled' => $q->update(['status' => 'cancelled'])];
    }

    /** Daha önce yüklenmiş dosya adları ("yeni fotoğraf" komutunda tekrar paylaşılmasın) */
    public function seen(User $actor, array $names): array
    {
        $norm = fn ($n) => mb_strtolower(preg_replace('/\.[a-z0-9]+$/i', '', basename((string) $n)), 'UTF-8');
        $wanted = [];
        foreach (array_slice($names, 0, 2000) as $n) $wanted[$norm($n)] = $n;
        if (!$wanted) return ['seen' => []];
        $have = [];
        $this->db->table('framio_media_images')->where('user_id', $actor->id)->select('filename')->orderBy('id')
            ->chunk(1000, function ($rows) use (&$have, $norm) {
                foreach ($rows as $r) $have[$norm($r->filename)] = true;
            });

        return ['seen' => array_values(array_map(fn ($k) => $wanted[$k], array_keys(array_intersect_key($wanted, $have))))];
    }

    public function forget(User $actor): array
    {
        $n = $this->db->table('framio_assistant_routes')->where('user_id', $actor->id)->delete();

        return ['ok' => true, 'removed' => $n];
    }
}
