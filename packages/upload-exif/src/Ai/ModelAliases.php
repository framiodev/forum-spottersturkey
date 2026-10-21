<?php

namespace Framio\UploadExif\Ai;

use Carbon\Carbon;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * Şehir içi ve kamyon/çekici başlıklarında Framio AI'nın marka/model yazımını forumun yazımına öğrenerek eşler:
 * kullanıcı AI'nın bulduğu "Mercedes Citaro C2 hybrid"i "Mercedes-Benz | Citaro C2 Hybrid" diye düzeltince,
 * AI aynı yanıtı bir daha verdiğinde forumdaki hâli yazılır.
 * Yönetici/moderatör düzeltmesi hemen geçerlidir; üyelerin düzeltmesi 2 farklı kişi aynı şekilde düzeltince.
 */
class ModelAliases
{
    public const TABLE = 'framio_ai_model_aliases';

    public function __construct(protected ConnectionInterface $db, protected SettingsRepositoryInterface $settings)
    {
    }

    public function available(): bool
    {
        return $this->db->getSchemaBuilder()->hasTable(self::TABLE);
    }

    public static function fold(?string $s): string
    {
        return trim(preg_replace('/[^a-z0-9]+/', ' ', strtr(mb_strtolower((string) $s, 'UTF-8'), ['ç' => 'c', 'ğ' => 'g', 'ı' => 'i', 'ö' => 'o', 'ş' => 's', 'ü' => 'u', 'i̇' => 'i'])));
    }

    protected function key(?string $brand, ?string $model): string
    {
        $b = self::fold($brand);
        $m = self::fold($model);
        if ($b !== '' && str_starts_with($m, $b . ' ')) $m = trim(substr($m, strlen($b)));

        return mb_substr($b . '|' . $m, 0, 190);
    }

    /** Başlığın etiketleri (+ üst etiketler) */
    public function slugs(?int $discussionId, ?string $tagSlug): array
    {
        $slugs = $tagSlug ? [$tagSlug] : [];
        if ($discussionId) {
            $slugs = array_merge($slugs, $this->db->table('discussion_tag')->join('tags', 'tags.id', '=', 'discussion_tag.tag_id')
                ->where('discussion_tag.discussion_id', $discussionId)->pluck('tags.slug')->all());
        }
        if ($slugs) {
            $slugs = array_merge($slugs, $this->db->table('tags as t')->join('tags as p', 'p.id', '=', 't.parent_id')->whereIn('t.slug', $slugs)->pluck('p.slug')->all());
        }

        return array_values(array_unique($slugs));
    }

    /** 'city' | 'truck' | null — admin ayarındaki etiketler ya da adresinde türü belli eden kelimeler */
    public function kind(array $slugs): ?string
    {
        foreach (['city' => ['framio-upload-exif.city_tag_slug', '/sehirici|sehir-ici/'], 'truck' => ['framio-upload-exif.truck_tag_slugs', '/kamyon|cekici|(^|-)tir(-|$)/']] as $kind => [$setting, $words]) {
            $list = array_filter(array_map('trim', explode(',', (string) $this->settings->get($setting, ''))));
            if (array_intersect($list, $slugs)) return $kind;
            foreach ($slugs as $s) if (preg_match($words, $s)) return $kind;
        }

        return null;
    }

    /** AI yanıtına öğrenilmiş eşlemeyi uygular; değiştiyse true */
    public function apply(string $kind, array &$data): bool
    {
        if (!$this->available() || empty($data['model'])) return false;
        $row = $this->db->table(self::TABLE)->where('kind', $kind)->where('ai_key', $this->key($data['brand'] ?? '', $data['model']))
            ->where(fn ($q) => $q->where('trusted', true)->orWhere('votes', '>=', 2))->first();
        if (!$row) return false;
        $data['brand'] = $row->brand;
        $data['model'] = $row->model;
        $data['model_source'] = 'learned';

        return true;
    }

    /** Kullanıcının düzeltmesini kaydeder */
    public function learn(string $kind, string $aiBrand, string $aiModel, string $brand, string $model, User $actor): void
    {
        if (!$this->available() || trim($aiModel) === '' || trim($model) === '') return;
        $key = $this->key($aiBrand, $aiModel);
        if ($key === $this->key($brand, $model)) return;
        $trusted = $actor->isAdmin() || $actor->hasPermission('discussion.editPosts');
        $row = $this->db->table(self::TABLE)->where('kind', $kind)->where('ai_key', $key)->first();
        $now = Carbon::now();
        if (!$row) {
            $this->db->table(self::TABLE)->insert(['kind' => $kind, 'ai_key' => $key, 'brand' => mb_substr($brand, 0, 100), 'model' => mb_substr($model, 0, 160),
                'voters' => json_encode([(int) $actor->id]), 'votes' => 1, 'trusted' => $trusted, 'updated_at' => $now]);

            return;
        }
        $same = self::fold($row->brand . ' ' . $row->model) === self::fold($brand . ' ' . $model);
        $voters = (array) json_decode((string) $row->voters, true);
        if ($same) {
            if (!in_array((int) $actor->id, $voters, true)) $voters[] = (int) $actor->id;
            $update = ['voters' => json_encode(array_slice($voters, -20)), 'votes' => count($voters), 'updated_at' => $now];
            if ($trusted) $update['trusted'] = true;
        } elseif ($trusted || !$row->trusted) {
            // Farklı düzeltme: yönetici her zaman, üye yalnızca henüz yönetici onaylı değilse baştan başlatır
            $update = ['brand' => mb_substr($brand, 0, 100), 'model' => mb_substr($model, 0, 160), 'voters' => json_encode([(int) $actor->id]), 'votes' => 1, 'trusted' => $trusted, 'updated_at' => $now];
        } else {
            return;
        }
        $this->db->table(self::TABLE)->where('id', $row->id)->update($update);
    }
}
