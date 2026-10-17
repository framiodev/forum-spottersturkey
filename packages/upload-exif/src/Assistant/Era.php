<?php

namespace Framio\UploadExif\Assistant;

use Carbon\Carbon;
use Illuminate\Database\ConnectionInterface;

/**
 * Güncel / Arşiv dönemleri.
 *
 * Forumlarda "Güncel …" ve "… Arşivi" üst etiketleri altında aynı adlı başlıklar bulunur.
 * Kural: çekim yılı içinde bulunduğumuz yıl ya da bir önceki yılsa (2026 → 2026, 2025) Güncel,
 * daha eskiyse Arşiv. Yıl döndüğünde (2027) bir önceki dönemin eski yılları Arşiv'e taşınır.
 * Üst etiketlerinde bu ayrım olmayan sitelerde kural kendiliğinden devre dışı kalır.
 */
class Era
{
    public const CURRENT = 'current';
    public const ARCHIVE = 'archive';

    protected array $tagEra = [];

    public function __construct(protected ConnectionInterface $db)
    {
    }

    /** Çekim yılına göre olması gereken dönem */
    public function forYear(?int $year): ?string
    {
        if (!$year) return null;

        return $year >= ((int) Carbon::now()->format('Y')) - 1 ? self::CURRENT : self::ARCHIVE;
    }

    /** Üst etiketin dönemi (adında "Güncel" ya da "Arşiv" geçmesine göre) */
    protected function tagEra(int $tagId): ?string
    {
        if (array_key_exists($tagId, $this->tagEra)) return $this->tagEra[$tagId];
        $tag = $this->db->table('tags')->where('id', $tagId)->first(['name', 'parent_id']);
        if (!$tag) return $this->tagEra[$tagId] = null;
        if ($tag->parent_id) return $this->tagEra[$tagId] = $this->tagEra((int) $tag->parent_id);
        $n = mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], (string) $tag->name), 'UTF-8');

        return $this->tagEra[$tagId] = str_contains($n, 'güncel') || str_contains($n, 'guncel') ? self::CURRENT
            : (str_contains($n, 'arşiv') || str_contains($n, 'arsiv') ? self::ARCHIVE : null);
    }

    /** Başlığın dönemi (etiketlerinden) */
    public function ofDiscussion(int $discussionId): ?string
    {
        foreach ($this->db->table('discussion_tag')->where('discussion_id', $discussionId)->pluck('tag_id') as $tagId) {
            if ($era = $this->tagEra((int) $tagId)) return $era;
        }

        return null;
    }

    /** Aynı adlı başlığın diğer dönemdeki karşılığı */
    public function mirror(int $discussionId, string $era): ?int
    {
        $title = $this->db->table('discussions')->where('id', $discussionId)->value('title');
        if (!$title) return null;
        foreach ($this->db->table('discussions')->where('title', $title)->where('id', '!=', $discussionId)->whereNull('hidden_at')->pluck('id') as $id) {
            if ($this->ofDiscussion((int) $id) === $era) return (int) $id;
        }

        return null;
    }

    /** Bu sitede Güncel/Arşiv ayrımı var mı? */
    public function enabled(): bool
    {
        foreach ($this->db->table('tags')->whereNull('parent_id')->pluck('id') as $id) {
            if ($this->tagEra((int) $id)) return true;
        }

        return false;
    }
}
