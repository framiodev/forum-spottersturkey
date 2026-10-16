<?php

namespace Framio\UploadExif\Ai;

use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Str;

/**
 * Vision AI sonucunu forumun geçmişiyle düzeltir (framio_seo_entities: künyelerden çıkarılan
 * marka / model / firma / plaka dizini).
 *
 *  - Plaka daha önce paylaşılmışsa: firma, marka ve model o geçmiş künyelerden alınır
 *    (aynı araç; en güvenilir kaynak).
 *  - Plaka yoksa firma adı forumda kullanılan tam haline tamamlanır
 *    ("Anka Turizm" → "Adıyaman Anka Turizm").
 *
 * Yalnızca admin'in seçtiği bölümlerde çalışır (boşsa her yerde).
 */
class VisionHistory
{
    protected const TABLE = 'framio_seo_entities';

    public function __construct(protected ConnectionInterface $db, protected SettingsRepositoryInterface $settings)
    {
    }

    public function available(): bool
    {
        static $ok;

        return $ok ??= $this->db->getSchemaBuilder()->hasTable(self::TABLE);
    }

    /** Bu konu / bölüm için geçmiş kullanılmalı mı? */
    public function appliesTo(?int $discussionId, ?string $tagSlug): bool
    {
        if (!$this->available()) return false;
        $allowed = array_filter(array_map('trim', explode(',', (string) $this->settings->get('framio-upload-exif.ai_history_tags', ''))));
        if (!$allowed) return true;

        $slugs = $tagSlug ? [$tagSlug] : [];
        if ($discussionId && $this->db->getSchemaBuilder()->hasTable('discussion_tag')) {
            $slugs = array_merge($slugs, $this->db->table('discussion_tag')->join('tags', 'tags.id', '=', 'discussion_tag.tag_id')
                ->where('discussion_tag.discussion_id', $discussionId)->pluck('tags.slug')->all());
        }
        // Üst etiketler de sayılır
        if ($slugs) {
            $parents = $this->db->table('tags as t')->join('tags as p', 'p.id', '=', 't.parent_id')->whereIn('t.slug', $slugs)->pluck('p.slug')->all();
            $slugs = array_merge($slugs, $parents);
        }

        return (bool) array_intersect($allowed, $slugs);
    }

    /** Model önerileri için forumda geçen model adları (marka => [model, …]) */
    public function knownModels(int $perBrand = 25): array
    {
        if (!$this->available()) return [];
        $rows = $this->db->table(self::TABLE)->where('type', 'model')->groupBy('name')
            ->selectRaw('name, COUNT(DISTINCT post_id) as n')->orderByDesc('n')->limit(400)->get();
        $brands = $this->db->table(self::TABLE)->where('type', 'brand')->distinct()->pluck('name')->all();
        usort($brands, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));
        $out = [];
        foreach ($rows as $r) {
            foreach ($brands as $b) {
                if (stripos($r->name, $b . ' ') === 0) {
                    if (count($out[$b] ?? []) < $perBrand) $out[$b][] = trim(mb_substr($r->name, mb_strlen($b)));
                    break;
                }
            }
        }

        return $out;
    }

    /**
     * @return array{data:array, notes:string[]}
     */
    public function enrich(array $data): array
    {
        $notes = [];
        $plate = $this->normPlate($data['plate'] ?? '');

        if ($plate !== '') {
            $postIds = $this->db->table(self::TABLE)->where('type', 'plate')->where('slug', Str::slug($plate))
                ->orderByDesc('posted_at')->limit(30)->pluck('post_id')->all();
            if ($postIds) {
                $top = fn (string $type) => $this->db->table(self::TABLE)->where('type', $type)->whereIn('post_id', $postIds)
                    ->groupBy('name')->selectRaw('name, COUNT(*) as n, MAX(posted_at) as last')
                    ->orderByDesc('n')->orderByDesc('last')->value('name');
                $brand = $top('brand');
                $model = $top('model');
                $company = $top('company');
                if ($brand) $data['brand'] = $brand;
                if ($model) $data['model'] = $brand && stripos($model, $brand . ' ') === 0 ? trim(mb_substr($model, mb_strlen($brand))) : $model;
                if ($company) $data['company'] = $company;
                $data['plate'] = $plate;
                $notes[] = 'plate';
            }
        }

        // Firma adını forumdaki tam haline tamamla
        if (!in_array('plate', $notes, true) && !empty($data['company'])) {
            $slug = Str::slug($data['company']);
            if ($slug !== '') {
                $names = $this->db->table(self::TABLE)->where('type', 'company')
                    ->where(fn ($q) => $q->where('slug', $slug)->orWhere('slug', 'like', '%-' . $slug)->orWhere('slug', 'like', $slug . '-%')->orWhere('slug', 'like', '%-' . $slug . '-%'))
                    ->distinct()->pluck('name', 'slug')->all();
                // Birebir aynı ad varsa o; birden çok farklı firma uyuyorsa ("Uludağ" → "Balıkesir Uludağ" mı
                // "Lüks Karadeniz Uludağ" mı?) tahmin yapılmaz, yapay zekanın okuduğu kalır
                $match = $names[$slug] ?? (count($names) === 1 ? reset($names) : null);
                if ($match && $match !== $data['company']) {
                    $data['company'] = $match;
                    $notes[] = 'company';
                }
            }
        }

        return ['data' => $data, 'notes' => $notes];
    }

    /**
     * Görsel olarak çok benzeyen geçmiş fotoğrafın künyesini referans alır: firma, marka ve model
     * oradan gelir; plaka, yapay zekanın okuduğuyla en fazla 2 karakter farklıysa düzeltilir.
     *
     * @return array{data:array, similar:array}
     */
    public function fromSimilar(array $data, array $match): array
    {
        $rows = $this->db->table(self::TABLE)->where('post_id', $match['post_id'])
            ->where(fn ($q) => $q->where('image_url', $match['image_url'])->orWhereNull('image_url'))
            ->get(['type', 'name']);
        $get = fn ($t) => optional($rows->firstWhere('type', $t))->name;

        $brand = $get('brand');
        $model = $get('model');
        if ($brand) $data['brand'] = $brand;
        if ($model) $data['model'] = $brand && stripos($model, $brand . ' ') === 0 ? trim(mb_substr($model, mb_strlen($brand))) : $model;
        if ($company = $get('company')) $data['company'] = $company;

        $plate = $get('plate');
        $read = $this->normPlate($data['plate'] ?? '');
        if ($plate && (!$read || levenshtein(str_replace(' ', '', $read), str_replace(' ', '', $plate)) <= 2)) {
            $data['plate'] = $plate;
        }

        $post = $this->db->table('posts')->where('id', $match['post_id'])->first(['discussion_id', 'number']);
        $match['url'] = $post ? '/d/' . $post->discussion_id . '/' . $post->number : null;
        $match['score'] = round($match['score'], 3);

        return ['data' => $data, 'similar' => $match];
    }

    protected function normPlate(string $p): string
    {
        $p = mb_strtoupper(trim(preg_replace('/\s+/u', ' ', $p)), 'UTF-8');
        // "02ADH788" → "02 ADH 788"
        if (preg_match('/^(\d{2})\s*([A-ZÇĞİÖŞÜ]{1,3})\s*(\d{2,4})$/u', $p, $m)) {
            return $m[1] . ' ' . $m[2] . ' ' . $m[3];
        }

        return '';
    }
}
