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
    public function __construct(protected ConnectionInterface $db, protected SettingsRepositoryInterface $settings, protected Era $era, protected \Framio\UploadExif\Ai\VisionAnalyzer $ai)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();
        $body = (array) ($request->getParsedBody() ?: []);
        $path = $request->getUri()->getPath();

        return match (true) {
            str_ends_with($path, '/parse') => new JsonResponse($this->understand($actor, (string) Arr::get($body, 'text', ''), (string) Arr::get($body, 'context', ''), (array) Arr::get($body, 'history', []), (array) Arr::get($body, 'card', []))),
            str_ends_with($path, '/targets') => new JsonResponse($this->targets($actor, $body)),
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
        if (preg_match('/(?<![\d\'’])(\d{1,3})\s*(?:tane|adet|fotoğraf|foto|görsel|resim|poz)/u', $t, $m) && !preg_match('/^(19|20)\d{2}$/', $m[1])) {
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
        if (!$query && preg_match('/["“”]([^"“”]{2,60})["“”]/u', $raw, $m)) $query = trim($m[1]);
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
        $shotYear = preg_match('/\b(19\d{2}|20\d{2})(?:\s*|\'?\s*(?:te|ta|de|da|’te|’de)?\s*)(?:çekim|yılı|yılında|tarihli|fotoğraf|foto|poz|görsel)/u', $t, $m) ? (int) $m[1] : null;
        $source = str_contains($t, 'drive') ? 'drive' : (preg_match('/(klasör|masaüstü|bilgisayar)/u', $t) ? 'local' : null);
        if (preg_match('/(?<![\d\'’])(\d{1,3})\s*(?:farklı)?\s*(?:poz|fotoğraf|foto|görsel)/u', $t, $m)) $count = (int) $m[1];
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

    /**
     * Komutu yapay zekayla anlar (karmaşık, çok koşullu istekler için); yapay zeka yoksa ya da yanıt
     * vermezse kural tabanlı ayrıştırıcı kullanılır. Plaka her zaman kural tabanlı okunur (kesin).
     * $context: asistanın o an sorduğu soru (cevap mı yeni komut mu ayırt etmek için)
     */
    public function understand(User $actor, string $text, string $context = '', array $history = [], array $card = []): array
    {
        $base = $this->parse($text);
        $candidates = $this->ai->candidates($actor);
        if (!$candidates || mb_strlen(trim($text)) < 3) return $base + ['ai' => false];

        $sections = [];
        foreach ($this->db->table('tags')->orderBy('position')->get(['id', 'name', 'slug', 'parent_id']) as $t) {
            if ($t->parent_id) continue;
            $era = $this->era->tagEra((int) $t->id);
            $sections[] = $t->name . ($era ? ' (' . ($era === Era::CURRENT ? 'Güncel' : 'Arşiv') . ')' : '');
        }
        $year = (int) Carbon::now()->format('Y');

        $prompt = "Bir ulaşım fotoğrafı forumunun Türkçe asistanısın. Kullanıcının mesajını aşağıdaki JSON'a çevir. Bugün: " . Carbon::now()->format('d.m.Y') . ".\n"
            . "Forum bölümleri: " . implode('; ', $sections) . ".\n"
            . "Güncel/Arşiv kuralı: çekim yılı {$year} ya da " . ($year - 1) . " ise Güncel, daha eskiyse Arşiv.\n"
            . "Sen konuşmayı bağlamıyla anlayan, akıllı ve doğal konuşan bir asistansın (Gemini/ChatGPT/Claude gibi). Önceki mesajlara bak: kullanıcı önceki bir işe atıfta bulunuyor, düzeltme yapıyor ya da soru soruyor olabilir.\n"
            . ($history ? "Son konuşma (eskiden yeniye):\n" . implode("\n", array_map(fn ($m) => (($m['who'] ?? '') === 'me' ? 'Kullanıcı: ' : 'Asistan: ') . mb_substr(str_replace(["\n", '"'], [' ', "'"], (string) ($m['text'] ?? '')), 0, 300), array_slice($history, -12))) . "\n" : '')
            . ($card ? "Şu an onay bekleyen fotoğraf kartı: " . json_encode($card, JSON_UNESCAPED_UNICODE) . "\n"
                . "Kullanıcı bu karttaki bir bilgiyi düzeltiyorsa (ör. \"model Travego değil Tourismo 16\", \"EGO değil, şehirlerarası başlığa\", \"yer Antalya\") action=\"correct\" yap ve corrections alanına YALNIZCA değişen alanları yaz.\n" : '')
            . ($context ? "Asistanın az önce sorduğu soru: \"$context\". Mesaj bu soruya bir CEVAP ise action=\"answer\" yap ve answer alanını doldur; yeni ve tam bir istekse cevap sayma.\n" : '')
            . "JSON alanları (bilinmeyeni null bırak):\n"
            . "{\"action\": \"share (tek araç/plaka) | batch (birden çok fotoğraf hemen) | plan (ileri tarihe zamanla) | search | schedule_list | schedule_cancel | folder | help | cancel | confirm | answer | correct (bekleyen karttaki bilgiyi düzeltme) | chat (soru, sohbet, açıklama isteği — iş değil)\",\n"
            . " \"corrections\": {\"company\": null, \"plate\": null, \"brand\": null, \"model\": null, \"location\": null, \"topic_hint\": \"istenen başlık/bölüm ipucu ya da null\"},\n"
            . " \"reply\": \"action chat ise kullanıcıya verilecek doğal, bilgili, kısa Türkçe yanıt; correct ise yaptığını anlatan kısa cümle; değilse null\",\n"
            . " \"count\": sayı ya da null, \"per_topic\": her hedef başlığa kaç adet (\"her başlıkta 1'er\" → 1) ya da null,\n"
            . " \"section\": hedef bölüm ipucu (ör. \"otobüs\", \"kamyon\", \"şehiriçi\") ya da null, \"era\": \"current\" | \"archive\" | null (\"güncel başlıklar\" → current),\n"
            . " \"topics_scope\": \"brand_topics\" (her markanın alt başlıkları) | \"one_topic\" | null, \"topic_name\": belirli başlık adı ya da null,\n"
            . " \"location\": çekim yeri filtresi (ör. \"Esenler Otogarı, İstanbul\") ya da null, \"shot_year\": çekim yılı ya da null,\n"
            . " \"source\": \"drive\" | \"local\" | null, \"only_new\": daha önce paylaşılmamış olanlar mı (true/false),\n"
            . " \"filters\": {\"company\": null, \"plate\": null, \"brand\": null, \"model\": null} (\"fark etmez\" denenler null),\n"
            . " \"auto\": kullanıcı soru sorulmadan/otomatik yapılmasını istiyorsa true, \"diverse\": her fotoğraf farklı araç olsun mu,\n"
            . " \"days\": null, \"per_day\": null, \"time\": \"HH:MM\" ya da null, \"notify\": haber verilsin mi,\n"
            . " \"answer\": {\"any\": soru serbest bırakıldıysa (\"fark etmez\", \"sen seç\", \"otomatik\") true, \"yes\": onay (\"evet\", \"başla\") true, \"no\": ret true, \"value\": verilen değer ya da null}}\n"
            . "Kullanıcının mesajı: \"" . str_replace('"', "'", $text) . "\"\nSADECE JSON döndür.";

        $j = $this->ai->completeJson($candidates, $prompt);
        if (!$j) return $base + ['ai' => false];

        $intent = $base;
        $action = (string) ($j['action'] ?? '');
        $intent['corrections'] = array_filter((array) ($j['corrections'] ?? []), fn ($v) => is_string($v) && trim($v) !== '');
        $intent['reply'] = is_string($j['reply'] ?? null) ? trim($j['reply']) : '';
        if (in_array($action, ['correct', 'chat'], true)) {
            return ['action' => $action, 'corrections' => $intent['corrections'], 'reply' => $intent['reply'], 'ai' => true] + $base;
        }
        if (in_array($action, ['share', 'batch', 'plan', 'search', 'schedule_list', 'schedule_cancel', 'folder', 'help', 'cancel', 'confirm', 'answer'], true)) {
            // Tek plaka verildiyse "share" kalır (kural tabanlı okuma kesin)
            $intent['action'] = $base['plate'] && in_array($action, ['batch', 'search'], true) ? $base['action'] : $action;
        }
        foreach (['count', 'days', 'per_day'] as $k) {
            if (isset($j[$k]) && is_numeric($j[$k])) $intent[$k] = (int) $j[$k];
        }
        if (!empty($j['time']) && preg_match('/^\d{1,2}:\d{2}$/', (string) $j['time'])) $intent['time'] = (string) $j['time'];
        if (!empty($j['shot_year'])) $intent['shot_year'] = (int) $j['shot_year'];
        if (in_array($j['source'] ?? null, ['drive', 'local'], true)) $intent['source'] = $j['source'];
        foreach (['notify', 'diverse', 'auto', 'only_new'] as $k) {
            if (isset($j[$k])) $intent[$k] = (bool) $j[$k];
        }
        $intent['per_topic'] = isset($j['per_topic']) && is_numeric($j['per_topic']) ? max(1, (int) $j['per_topic']) : null;
        $intent['section'] = $j['section'] ?? null;
        $intent['era'] = in_array($j['era'] ?? null, ['current', 'archive'], true) ? $j['era'] : null;
        $intent['topics_scope'] = $j['topics_scope'] ?? null;
        $intent['topic_name'] = $j['topic_name'] ?? null;
        $intent['location'] = $j['location'] ?? null;
        $intent['filters'] = array_filter((array) ($j['filters'] ?? []), fn ($v) => is_string($v) && trim($v) !== '');
        $intent['answer'] = (array) ($j['answer'] ?? []);
        $intent['ai'] = true;

        // Plaka yokken çok koşullu bir paylaşım isteği her zaman çoklu iştir (tek araç "share" değil)
        if (in_array($intent['action'], ['share', 'search'], true) && !$intent['plate']
            && ($intent['per_topic'] || $intent['topics_scope'] === 'brand_topics' || ($intent['count'] ?? 0) > 1 || $intent['shot_year'] || $intent['location'] || ($intent['auto'] ?? false) && $intent['action'] === 'share')) {
            $intent['action'] = ($intent['days'] || $intent['per_day'] || $intent['time']) ? 'plan' : 'batch';
        }
        // Yeni bir istekte "answer" yorumu gereksiz
        if ($intent['action'] !== 'answer') $intent['answer'] = [];

        return $intent;
    }

    /**
     * Hedef başlıklar: "güncel otobüs başlıklarında her markanın alt başlıkları" → o bölümdeki (ve dönemdeki)
     * marka etiketlerinin altındaki fotoğraf başlıkları. "Diğer Konular" gibi genel etiketler dışarıda kalır.
     */
    public function targets(User $actor, array $body): array
    {
        $section = mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], (string) Arr::get($body, 'section', '')), 'UTF-8');
        $words = array_values(array_filter(preg_split('/\s+/u', $section), fn ($w) => mb_strlen($w) > 3));
        $era = Arr::get($body, 'era');
        $tags = $this->db->table('tags')->get(['id', 'name', 'slug', 'parent_id'])->keyBy('id');
        $lower = fn ($v) => mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], (string) $v), 'UTF-8');
        $rootOf = function ($id) use ($tags, &$rootOf) {
            $t = $tags[$id] ?? null;
            return $t && $t->parent_id ? $rootOf($t->parent_id) : $id;
        };

        $tagIds = [];
        foreach ($tags as $t) {
            if (!$t->parent_id) continue; // marka/alt etiketler
            $name = $lower($t->name);
            if (preg_match('/(diğer konu|sohbet|haber|arşiv içerik)/u', $name)) continue;
            $root = $tags[$rootOf($t->id)] ?? null;
            if ($words && !collect($words)->contains(fn ($w) => str_contains($lower($root->name ?? ''), mb_substr($w, 0, 6)))) continue;
            if ($era && $this->era->tagEra((int) $t->id) !== $era && !($era === Era::CURRENT && $this->era->tagEra((int) $t->id) === null)) continue;
            $tagIds[] = (int) $t->id;
        }
        if (!$tagIds) return ['topics' => []];

        $rows = $this->db->table('discussions')->join('discussion_tag', 'discussion_tag.discussion_id', '=', 'discussions.id')
            ->whereIn('discussion_tag.tag_id', $tagIds)->whereNull('discussions.hidden_at')
            ->select('discussions.id', 'discussions.title', 'discussion_tag.tag_id')->orderBy('discussions.id')->get();
        $out = [];
        foreach ($rows as $r) {
            if (isset($out[$r->id])) continue;
            if (!$this->describe((int) $r->id, $actor)) continue;
            if ($era && $this->era->ofDiscussion((int) $r->id) !== $era) continue;
            $rootTag = $tags[$rootOf($r->tag_id)] ?? null;
            $out[$r->id] = ['discussion_id' => (int) $r->id, 'title' => $r->title, 'brand' => $tags[$r->tag_id]->name ?? '', 'section' => $rootTag->name ?? '', 'section_slug' => $rootTag->slug ?? ''];
        }

        // Birden çok bölüm eşleştiyse (ör. "otobüs" → Şehirlerarası + Turizm) hangisi olduğu sorulabilsin
        $sections = [];
        foreach ($out as $t) $sections[$t['section_slug']] = ['slug' => $t['section_slug'], 'name' => $t['section'], 'count' => ($sections[$t['section_slug']]['count'] ?? 0) + 1];

        return ['topics' => array_values($out), 'sections' => array_values($sections)];
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
            // 0) Konunun devamı: bu plaka daha önce paylaşıldıysa aynı başlık; ardından aynı firmanın aynı modeli
            $plate = Str::slug(preg_replace('/\s+/', ' ', strtoupper(trim((string) Arr::get($body, 'plate', '')))));
            $company = trim((string) Arr::get($body, 'company', ''));
            if ($plate !== '') {
                $rows = $this->db->table('framio_seo_entities')->where('type', 'plate')->where('slug', $plate)
                    ->groupBy('discussion_id')->selectRaw('discussion_id, COUNT(DISTINCT post_id) as n, MAX(post_id) as last')
                    ->orderByDesc('n')->orderByDesc('last')->limit(3)->get();
                foreach ($rows as $row) {
                    if (collect($out)->contains('discussion_id', (int) $row->discussion_id)) continue;
                    if ($d = $this->describe((int) $row->discussion_id, $actor)) $out[] = $d + ['reason' => 'plate', 'count' => (int) $row->n];
                }
            }
            if ($company !== '' && $brand) {
                $ids = $this->db->table('framio_seo_entities')->where('type', 'company')->where('slug', Str::slug($company))->pluck('post_id');
                $q = $this->db->table('framio_seo_entities')->whereIn('post_id', $ids)
                    ->where('type', $model ? 'model' : 'brand')->where('slug', Str::slug($model ? $brand . ' ' . $model : $brand))
                    ->groupBy('discussion_id')->selectRaw('discussion_id, COUNT(DISTINCT post_id) as n')->orderByDesc('n')->limit(2)->get();
                foreach ($q as $row) {
                    if (collect($out)->contains('discussion_id', (int) $row->discussion_id)) continue;
                    if ($d = $this->describe((int) $row->discussion_id, $actor)) $out[] = $d + ['reason' => $model ? 'model' : 'brand', 'count' => (int) $row->n];
                }
            }
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

        // Model biliniyorsa başlık adı modeli içermeli (ör. Tourismo fotoğrafı EGO ya da Travego başlığına önerilmez);
        // uyan başlık yoksa başlık adlarında model aranır
        $modelName = trim((string) Arr::get($body, 'model', ''));
        if ($modelName !== '') {
            $key = mb_strtolower(preg_split('/\s+/', $modelName)[0], 'UTF-8');
            if (mb_strlen($key) >= 3) {
                $out = array_values(array_filter($out, fn ($s) => str_contains(mb_strtolower($s['title'], 'UTF-8'), $key)));
                if (!$out) {
                    $ids = $this->db->table('discussions')->whereNull('hidden_at')
                        ->where('title', 'like', '%' . $key . '%')->orderByDesc('comment_count')->limit(6)->pluck('id');
                    foreach ($ids as $id) {
                        if ($d = $this->describe((int) $id, $actor)) $out[] = $d + ['reason' => 'title'];
                    }
                }
                $auto = $auto && (bool) $out;
            }
        }

        // Güncel / Arşiv: çekim yılına göre doğru döneme ait aynı adlı başlık kullanılır
        $want = $this->era->forYear((int) Arr::get($body, 'year') ?: null);
        if ($want && $this->era->enabled()) {
            $fixed = [];
            foreach ($out as $sug) {
                $era = $this->era->ofDiscussion($sug['discussion_id']);
                if ($era && $era !== $want) {
                    $mirror = $this->era->counterpart($sug['discussion_id'], $want, (string) Arr::get($body, 'brand', ''));
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

        // Klasör yolu ipucu ("…/Şehirlerarası Otobüsler"): o bölümdeki başlıklar öne alınır
        $hint = mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], (string) Arr::get($body, 'hint', '')), 'UTF-8');
        $words = array_values(array_filter(preg_split('/[\s\/_.-]+/u', $hint), fn ($w) => mb_strlen($w) > 3 && !preg_match('/^\d+$/', $w)));
        if ($words && count($out) > 1) {
            foreach ($out as $i => &$sug) {
                $names = mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], implode(' ', $this->db->table('discussion_tag')->join('tags', 'tags.id', '=', 'discussion_tag.tag_id')
                    ->where('discussion_tag.discussion_id', $sug['discussion_id'])->pluck('tags.name')->all())), 'UTF-8');
                $sug['_score'] = count(array_filter($words, fn ($w) => str_contains($names, mb_substr($w, 0, 6)))) * 10 - $i;
            }
            unset($sug);
            usort($out, fn ($a, $b) => $b['_score'] <=> $a['_score']);
            $out = array_map(function ($x) { unset($x['_score']); return $x; }, $out);
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
