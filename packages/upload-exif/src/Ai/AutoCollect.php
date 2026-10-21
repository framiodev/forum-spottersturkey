<?php

namespace Framio\UploadExif\Ai;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Event\Posted;
use Flarum\Post\CommentPost;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use GuzzleHttp\Client;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\ConnectionInterface;
use Throwable;

/**
 * Otomatik koleksiyon başlıkları (admin "framio-upload-exif.auto_collect_rules"):
 * fotoğraflı bir gönderi kuralın sorusuna "evet" alırsa (ör. "Araç ağırlıklı olarak beyaz dışında bir renkte mi?")
 * hedef başlığa da eklenir. Eklenen mesaj gönderinin sahibi adına, kaynağa bağlantıyla yazılır.
 * Her karar framio_auto_collect tablosunda tutulur: aynı gönderi aynı kural için bir daha sorulmaz.
 */
class AutoCollect
{
    public const LOG = 'framio_auto_collect';

    public function __construct(
        protected ConnectionInterface $db,
        protected SettingsRepositoryInterface $settings,
        protected VisionAnalyzer $vision
    ) {
    }

    public function ready(): bool
    {
        return $this->db->getSchemaBuilder()->hasTable(self::LOG);
    }

    /** @return array<int, array{key:string,name:string,target:int,question:string,tags:string[],active:bool}> */
    public function rules(): array
    {
        $out = [];
        foreach ((array) json_decode((string) $this->settings->get('framio-upload-exif.auto_collect_rules', '[]'), true) as $r) {
            $target = (int) preg_replace('/^.*\/d\/(\d+).*$/', '$1', (string) ($r['target'] ?? ''));
            if (!$target || trim((string) ($r['question'] ?? '')) === '') continue;
            $out[] = [
                'key' => (string) ($r['key'] ?? md5(($r['target'] ?? '') . ($r['question'] ?? ''))),
                'name' => (string) ($r['name'] ?? ''),
                'target' => $target,
                'question' => trim((string) $r['question']),
                'tags' => array_values(array_filter(array_map('trim', explode(',', (string) ($r['tags'] ?? ''))))),
                'active' => ($r['active'] ?? true) !== false && ($r['active'] ?? '1') !== '0',
            ];
        }

        return $out;
    }

    public function rule(string $key): ?array
    {
        foreach ($this->rules() as $r) if ($r['key'] === $key) return $r;

        return null;
    }

    /** Kurala göre henüz sorulmamış fotoğraflı gönderiler (en yeniden eskiye) */
    public function pending(array $rule, int $limit, ?int $minId = null): array
    {
        $done = $this->db->table(self::LOG)->where('rule_key', $rule['key'])->pluck('source_post_id')->all();
        $targets = $this->db->table(self::LOG)->whereNotNull('target_post_id')->pluck('target_post_id')->all();
        $q = CommentPost::query()->where('type', 'comment')->whereNull('hidden_at')->where('discussion_id', '!=', $rule['target'])
            ->where('content', 'like', '%id=%')
            ->whereNotIn('id', array_merge($done, $targets) ?: [0]);
        if ($minId) $q->where('id', '>', $minId);
        if ($rule['tags']) {
            $tagIds = $this->db->table('tags')->whereIn('slug', $rule['tags'])->pluck('id')->all();
            $tagIds = array_merge($tagIds, $this->db->table('tags')->whereIn('parent_id', $tagIds ?: [0])->pluck('id')->all());
            $q->whereIn('discussion_id', $this->db->table('discussion_tag')->whereIn('tag_id', $tagIds ?: [0])->pluck('discussion_id')->all() ?: [0]);
        }

        return $q->orderByDesc('id')->limit($limit)->get()->all();
    }

    /** Gönderideki ilk fotoğrafın 480 px adresi */
    public function imageOf(CommentPost $post): ?string
    {
        if (!preg_match('/\bid=["\']?(\d+)/', (string) $post->content, $m)) return null;
        $path = $this->db->table('framio_media_images')->where('id', (int) $m[1])->value('path');
        if (!$path) return null;
        $path = preg_replace('/\?.*$/', '', $path);
        if (str_starts_with($path, '/')) $path = rtrim(app()->url(), '/') . $path;

        return $path . '?w=480';
    }

    /** @return array{answer:bool, confidence:string, image:?string, error:?string} */
    public function judge(CommentPost $post, array $rule): array
    {
        $url = $this->imageOf($post);
        if (!$url) return ['answer' => false, 'confidence' => 'none', 'image' => null, 'error' => 'görsel yok'];
        $cands = $this->vision->candidates(null);
        if (!$cands) return ['answer' => false, 'confidence' => 'none', 'image' => $url, 'error' => 'yapay zekâ sağlayıcısı yok'];
        try {
            $client = new Client(['timeout' => 20, 'connect_timeout' => 4]);
            $bytes = (string) $client->get($url)->getBody();
            [$small, $mime] = $this->vision->shrink($bytes, 'image/jpeg', 512, true);
            $prompt = "Bu bir ulaşım aracı fotoğrafı. Şu soruyu fotoğraftaki ANA araç için yanıtla:\n" . $rule['question']
                . "\nYalnızca şu JSON'u döndür: {\"answer\": \"yes|no\", \"confidence\": \"high|medium|low\"}. Emin değilsen \"no\" ve \"low\". SADECE JSON.";
            $res = $this->vision->askAsync($client, $cands[0], base64_encode($small), $mime, $prompt, 20)->wait();
            $yes = strtolower((string) ($res['answer'] ?? '')) === 'yes';

            return ['answer' => $yes, 'confidence' => strtolower((string) ($res['confidence'] ?? 'low')), 'image' => $url, 'error' => null];
        } catch (Throwable $e) {
            return ['answer' => false, 'confidence' => 'none', 'image' => $url, 'error' => mb_substr($e->getMessage(), 0, 200)];
        }
    }

    public static function accepted(array $j): bool
    {
        return $j['answer'] && in_array($j['confidence'], ['high', 'medium'], true);
    }

    /** Kararı kaydeder; kabul edildiyse ve $publish ise hedef başlığa ekler */
    public function decide(CommentPost $post, array $rule, array $j, bool $publish): ?int
    {
        if ($j['error'] && $j['confidence'] === 'none' && $j['error'] !== 'görsel yok') return null; // geçici hata: sonra yeniden denenir
        $targetPostId = null;
        if ($publish && self::accepted($j)) $targetPostId = $this->publish($post, $rule);
        $this->db->table(self::LOG)->updateOrInsert(
            ['rule_key' => $rule['key'], 'source_post_id' => $post->id],
            ['decision' => $j['answer'] ? 'yes' : 'no', 'confidence' => $j['confidence'], 'target_post_id' => $targetPostId, 'created_at' => Carbon::now()]
        );

        return $targetPostId;
    }

    /** Gönderinin içeriği + kaynak bağlantısı, gönderi sahibi adına hedef başlığa */
    public function publish(CommentPost $post, array $rule): ?int
    {
        $target = Discussion::find($rule['target']);
        $author = $post->user ?: User::where('is_email_confirmed', 1)->orderBy('id')->first();
        if (!$target || !$author) return null;
        $source = $post->discussion;
        $link = rtrim(app()->url(), '/') . '/d/' . $post->discussion_id . '/' . $post->number;
        $content = rtrim((string) $post->content) . "\n\n*Otomatik koleksiyon · kaynak: [" . str_replace(['[', ']'], '', (string) optional($source)->title) . '](' . $link . ')*';
        try {
            // Flarum 2'de komut yolu yok: mesaj doğrudan oluşturulur, başlık sayaçları güncellenir, olay yayınlanır
            $reply = new CommentPost();
            $reply->discussion_id = $target->id;
            $reply->user_id = $author->id;
            $reply->created_at = Carbon::now();
            $reply->number = (int) ($target->last_post_number ?: $target->posts()->max('number') ?: 0) + 1;
            $reply->setContentAttribute($content, $author);
            $reply->save();
            $target->setLastPost($reply);
            $target->last_post_number = $reply->number;
            $target->comment_count = $target->posts()->where('type', 'comment')->count();
            $target->participant_count = $target->posts()->select('user_id')->distinct()->count('user_id');
            $target->save();
            try { resolve(Dispatcher::class)->dispatch(new Posted($reply, $author)); } catch (Throwable $e) {}

            return (int) $reply->id;
        } catch (Throwable $e) {
            resolve('log')->warning('[auto-collect] Eklenemedi (#' . $post->id . ' → ' . $target->id . '): ' . $e->getMessage());

            return null;
        }
    }
}
