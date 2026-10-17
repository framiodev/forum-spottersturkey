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
    public function __construct(protected ConnectionInterface $db, protected SettingsRepositoryInterface $settings)
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

        return ['action' => $action, 'plate' => $plate, 'query' => $query, 'count' => $count, 'tag' => $tag, 'text' => $raw];
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
        foreach ($this->keys($body) as $key) {
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

        return ['suggestions' => array_slice($out, 0, 5), 'auto' => $auto, 'auto_after' => $this->autoAfter()];
    }

    // ── Öğrenme ──────────────────────────────────────────────────────────────

    public function learn(User $actor, array $body): array
    {
        $discussionId = (int) Arr::get($body, 'discussion_id');
        if (!$discussionId || !$this->describe($discussionId, $actor)) {
            return ['ok' => false];
        }
        foreach ($this->keys($body) as $key) {
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

    public function forget(User $actor): array
    {
        $n = $this->db->table('framio_assistant_routes')->where('user_id', $actor->id)->delete();

        return ['ok' => true, 'removed' => $n];
    }
}
