<?php

namespace Framio\UploadExif\Ai;

use Carbon\Carbon;
use Flarum\Post\CommentPost;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\ConnectionInterface;

/**
 * Yazım standardı (admin "framio-upload-exif.canon_rules"): aynı firma/marka/model/yer için tek yazım.
 *   firma: Varan Turizm, Varan Tur => Varan
 *   firma: İzmir => İzmir Turizm
 *   marka: Mercedes, Mercedes Benz => Mercedes-Benz
 *   yer: AŞTİ, Ankara Otogarı => Ankara AŞTİ
 * Eşleşme değerin TAMAMI üzerinden (büyük/küçük harf, Türkçe karakter, noktalama farkı yok sayılır).
 * Yapay zekâ yanıtına, künye onayına ve (admin isteğiyle) eski gönderilere uygulanır.
 */
class CanonRules
{
    public const FIELDS = ['firma' => 'company', 'marka' => 'brand', 'model' => 'model', 'yer' => 'location'];
    public const ENTITY = ['company' => 'company', 'brand' => 'brand', 'model' => 'model', 'location' => 'place'];
    public const BACKUP = 'framio_canon_backups';

    public function __construct(protected SettingsRepositoryInterface $settings, protected ConnectionInterface $db)
    {
    }

    /** @return array<string, array<string, string>> alan → (katlanmış varyant → doğru yazım) */
    public function rules(): array
    {
        $out = [];
        foreach (preg_split('/\r?\n/', (string) $this->settings->get('framio-upload-exif.canon_rules', '')) as $line) {
            if (!preg_match('/^\s*(firma|marka|model|yer)\s*:\s*(.+?)\s*=>\s*(.+?)\s*$/iu', $line, $m)) continue;
            $field = self::FIELDS[mb_strtolower($m[1])];
            foreach (explode(',', $m[2]) as $v) {
                $f = ModelAliases::fold($v);
                if ($f !== '' && $f !== ModelAliases::fold($m[3])) $out[$field][$f] = trim($m[3]);
            }
        }

        return $out;
    }

    public function one(string $field, ?string $value): ?string
    {
        $v = trim((string) $value);
        if ($v === '') return $value;

        return $this->rules()[$field][ModelAliases::fold($v)] ?? $value;
    }

    /** Yapay zekâ yanıtındaki alanlar */
    public function applyData(array $data): array
    {
        $rules = $this->rules();
        foreach (self::FIELDS as $field) {
            if (!empty($data[$field]) && is_string($data[$field]) && isset($rules[$field][ModelAliases::fold($data[$field])])) {
                $data[$field] = $rules[$field][ModelAliases::fold($data[$field])];
            }
        }

        return $data;
    }

    /**
     * Eski gönderiler: varyantı taşıyan künye satırlarında ilgili parça doğru yazımla değiştirilir.
     * Hangi gönderilerin etkileneceği SEO varlık dizininden (firma/marka/model/yer) bulunur.
     * @return array<int, array{post_id:int, discussion:string, before:string, after:string}>
     */
    public function plan(int $limit = 500): array
    {
        $rules = $this->rules();
        if (!$rules || !$this->db->getSchemaBuilder()->hasTable('framio_seo_entities')) return [];
        $changes = [];
        foreach ($rules as $field => $map) {
            $names = $this->db->table('framio_seo_entities')->where('type', self::ENTITY[$field])->distinct()->pluck('name')
                ->filter(fn ($n) => isset($map[ModelAliases::fold($n)]))->all();
            if (!$names) continue;
            $posts = $this->db->table('framio_seo_entities')->where('type', self::ENTITY[$field])->whereIn('name', $names)
                ->distinct()->limit($limit)->get(['post_id', 'name']);
            foreach ($posts as $p) {
                $changes[$p->post_id][] = [$p->name, $map[ModelAliases::fold($p->name)], $field];
            }
        }
        $out = [];
        foreach (array_slice($changes, 0, $limit, true) as $postId => $repls) {
            $post = CommentPost::find($postId);
            if (!$post) continue;
            $before = (string) $post->content;
            $after = $this->rewrite($before, $repls);
            if ($after === $before) continue;
            $out[] = ['post_id' => (int) $postId, 'discussion' => (string) optional($post->discussion)->title, 'before' => $this->diffLine($before, $after, true), 'after' => $this->diffLine($before, $after, false), 'content' => $after];
        }

        return $out;
    }

    /** Künye satırlarında ("- **...**"), ayırıcılarla bölünmüş parçalardan TAM eşleşen ilkini değiştirir */
    public function rewrite(string $content, array $repls): string
    {
        foreach ($repls as [$from, $to]) {
            $done = false;
            $content = preg_replace_callback('/^(\s*[-*+]\s+\*\*)(.+?)(\*\*\s*)$/mu', function ($m) use ($from, $to, &$done) {
                if ($done) return $m[0];
                $parts = preg_split('/(\s+[|\/&]\s+|\s+-\s+)/u', $m[2], -1, PREG_SPLIT_DELIM_CAPTURE);
                foreach ($parts as $i => $part) {
                    if ($i % 2 === 0 && ModelAliases::fold($part) === ModelAliases::fold($from)) {
                        $parts[$i] = $to;
                        $done = true;
                        return $m[1] . implode('', $parts) . $m[3];
                    }
                    // Marka + model tek parçada ("Mercedes Tourismo"): baştaki marka
                    if ($i === 0 && str_starts_with(ModelAliases::fold($part) . ' ', ModelAliases::fold($from) . ' ') && ModelAliases::fold($part) !== ModelAliases::fold($from)
                        && !str_starts_with(ModelAliases::fold($part) . ' ', ModelAliases::fold($to) . ' ')) {
                        $words = preg_split('/\s+/u', trim($from));
                        $partWords = preg_split('/\s+/u', trim($part));
                        if (count($partWords) > count($words)) {
                            $parts[$i] = $to . ' ' . implode(' ', array_slice($partWords, count($words)));
                            $done = true;
                            return $m[1] . implode('', $parts) . $m[3];
                        }
                    }
                }
                return $m[0];
            }, $content);
        }

        return $content;
    }

    protected function diffLine(string $a, string $b, bool $first): string
    {
        $la = preg_split('/\r?\n/', $a);
        $lb = preg_split('/\r?\n/', $b);
        foreach ($la as $i => $line) {
            if (($lb[$i] ?? null) !== $line) return trim($first ? $line : ($lb[$i] ?? ''));
        }

        return '';
    }

    /** Planı uygular: eski içerik yedeklenir, gönderi yeniden işlenir, SEO dizini güncellenir */
    public function apply(array $plan, string $batch): int
    {
        $n = 0;
        foreach ($plan as $row) {
            $post = CommentPost::find($row['post_id']);
            if (!$post) continue;
            $this->db->table(self::BACKUP)->insert(['batch' => $batch, 'post_id' => $post->id, 'content' => (string) $post->content, 'created_at' => Carbon::now()]);
            $post->setContentAttribute($row['content'], $post->user);
            $post->save();
            if (class_exists(\Framio\SeoPack\Support\EntityIndex::class)) {
                try { resolve(\Framio\SeoPack\Support\EntityIndex::class)->index($post); } catch (\Throwable $e) {}
            }
            $n++;
        }

        return $n;
    }

    /** Son uygulamayı geri alır */
    public function undo(): int
    {
        $batch = $this->db->table(self::BACKUP)->orderByDesc('id')->value('batch');
        if (!$batch) return 0;
        $n = 0;
        foreach ($this->db->table(self::BACKUP)->where('batch', $batch)->get() as $b) {
            $post = CommentPost::find($b->post_id);
            if ($post) {
                $post->setContentAttribute($b->content, $post->user);
                $post->save();
                if (class_exists(\Framio\SeoPack\Support\EntityIndex::class)) {
                    try { resolve(\Framio\SeoPack\Support\EntityIndex::class)->index($post); } catch (\Throwable $e) {}
                }
                $n++;
            }
        }
        $this->db->table(self::BACKUP)->where('batch', $batch)->delete();

        return $n;
    }
}
