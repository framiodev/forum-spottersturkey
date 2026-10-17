<?php

namespace Framio\UploadExif\Assistant;

use Carbon\Carbon;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Str;

/**
 * Güncel / Arşiv dönemleri (yalnızca YENİ paylaşımın nereye gideceğini belirler; mevcut mesajlar
 * hiçbir zaman taşınmaz).
 *
 * Kural: çekim yılı içinde bulunduğumuz yıl ya da bir önceki yılsa Güncel, daha eskiyse Arşiv
 * (2026'da: 2026 ve 2025 Güncel, 2024 ve öncesi Arşiv; 2027'de 2025 de Arşiv'e yönlenir).
 *
 * Etiketlerin dönemi:
 *  - Admin ayarı (öncelikli): Güncel / Arşiv etiket kısa adları; alt etiketler üstünden miras alır.
 *  - Ayar boşsa otomatik: adında "Arşiv" geçen etiket (ve altı) Arşiv'dir; adında "Güncel" geçen
 *    Güncel'dir; sitede Arşiv etiketi varsa geri kalan fotoğraf başlıkları Güncel sayılır.
 *    Spotters: "Güncel …" / "… Arşivi" üst etiketleri. Ulaşım Arşiv: her bölümde "Arşiv İçerikleri" alt etiketi.
 *
 * Arşiv karşılığı (yeni paylaşım eski bir çekimse):
 *  1) Arşiv'de aynı adlı başlık (Spotters),
 *  2) aynı bölümdeki Arşiv etiketinde markanın başlığı ("Arşiv İçerikleri → Mercedes-Benz"),
 *  3) aynı bölümdeki Arşiv etiketinde "Diğer …" başlığı.
 */
class Era
{
    public const CURRENT = 'current';
    public const ARCHIVE = 'archive';

    protected array $tagEra = [];
    protected ?array $tags = null;

    public function __construct(protected ConnectionInterface $db, protected SettingsRepositoryInterface $settings)
    {
    }

    public function forYear(?int $year): ?string
    {
        if (!$year) return null;

        return $year >= ((int) Carbon::now()->format('Y')) - 1 ? self::CURRENT : self::ARCHIVE;
    }

    protected function tags(): array
    {
        return $this->tags ??= $this->db->table('tags')->get(['id', 'name', 'slug', 'parent_id'])->keyBy('id')->all();
    }

    protected function list(string $key): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/[\s,]+/', (string) $this->settings->get('framio-upload-exif.' . $key, '')))));
    }

    protected function manual(): bool
    {
        return (bool) ($this->list('era_current_tags') || $this->list('era_archive_tags'));
    }

    /** Etiketin (ya da üst etiketinin) dönemi; belirsizse null */
    public function tagEra(int $tagId): ?string
    {
        if (array_key_exists($tagId, $this->tagEra)) return $this->tagEra[$tagId];
        $tag = $this->tags()[$tagId] ?? null;
        if (!$tag) return $this->tagEra[$tagId] = null;

        if ($this->manual()) {
            if (in_array($tag->slug, $this->list('era_archive_tags'), true)) return $this->tagEra[$tagId] = self::ARCHIVE;
            if (in_array($tag->slug, $this->list('era_current_tags'), true)) return $this->tagEra[$tagId] = self::CURRENT;
        } else {
            $n = mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], (string) $tag->name), 'UTF-8');
            if (str_contains($n, 'arşiv') || str_contains($n, 'arsiv')) return $this->tagEra[$tagId] = self::ARCHIVE;
            if (str_contains($n, 'güncel') || str_contains($n, 'guncel')) return $this->tagEra[$tagId] = self::CURRENT;
        }

        return $this->tagEra[$tagId] = $tag->parent_id ? $this->tagEra((int) $tag->parent_id) : null;
    }

    /** Sitede Arşiv olarak tanımlı (ya da adından anlaşılan) bir etiket var mı? */
    public function enabled(): bool
    {
        foreach (array_keys($this->tags()) as $id) {
            if ($this->tagEra((int) $id) === self::ARCHIVE) return true;
        }

        return false;
    }

    protected function discussionTags(int $discussionId): array
    {
        return $this->db->table('discussion_tag')->where('discussion_id', $discussionId)->pluck('tag_id')->map(fn ($v) => (int) $v)->all();
    }

    public function ofDiscussion(int $discussionId): ?string
    {
        $eras = array_map(fn ($t) => $this->tagEra($t), $this->discussionTags($discussionId));
        if (in_array(self::ARCHIVE, $eras, true)) return self::ARCHIVE;
        if (in_array(self::CURRENT, $eras, true)) return self::CURRENT;

        // Arşiv tanımlı sitelerde dönemi belirsiz fotoğraf başlıkları Güncel sayılır
        return $this->enabled() ? self::CURRENT : null;
    }

    protected function root(int $tagId): int
    {
        $t = $this->tags()[$tagId] ?? null;

        return $t && $t->parent_id ? $this->root((int) $t->parent_id) : $tagId;
    }

    /**
     * Başlığın istenen dönemdeki karşılığı.
     * $brand: aracın markası (Arşiv'in marka başlıkları için)
     */
    public function counterpart(int $discussionId, string $era, ?string $brand = null): ?int
    {
        $title = (string) $this->db->table('discussions')->where('id', $discussionId)->value('title');

        // 1) Aynı adlı başlık
        foreach ($this->db->table('discussions')->where('title', $title)->where('id', '!=', $discussionId)->whereNull('hidden_at')->pluck('id') as $id) {
            if ($this->ofDiscussion((int) $id) === $era) return (int) $id;
        }

        // 2-3) Aynı bölümün (kök etiket) istenen dönemdeki etiketlerinde marka ya da "Diğer" başlığı
        $roots = array_unique(array_map(fn ($t) => $this->root($t), $this->discussionTags($discussionId)));
        $eraTags = array_values(array_filter(array_keys($this->tags()), fn ($t) => $this->tagEra((int) $t) === $era && in_array($this->root((int) $t), $roots, true)));
        if (!$eraTags) return null;

        $candidates = $this->db->table('discussions')->join('discussion_tag', 'discussion_tag.discussion_id', '=', 'discussions.id')
            ->whereIn('discussion_tag.tag_id', $eraTags)->whereNull('discussions.hidden_at')
            ->select('discussions.id', 'discussions.title')->distinct()->get();

        // Marka: AI'nın markası, yoksa başlığın marka etiketi ya da başlığın ilk kelimesi
        $brands = array_filter([$brand]);
        foreach ($this->discussionTags($discussionId) as $t) {
            $tag = $this->tags()[$t] ?? null;
            if ($tag && $tag->parent_id && $this->tagEra($t) !== self::ARCHIVE) $brands[] = $tag->name;
        }
        $brands[] = Str::before($title, ' ');
        foreach ($brands as $b) {
            $slug = Str::slug((string) $b);
            if ($slug === '') continue;
            foreach ($candidates as $c) {
                if (Str::slug($c->title) === $slug) return (int) $c->id;
            }
            foreach ($candidates as $c) {
                if (str_starts_with(Str::slug($c->title), $slug)) return (int) $c->id;
            }
        }
        foreach ($candidates as $c) {
            if (str_starts_with(Str::slug($c->title), 'diger')) return (int) $c->id;
        }

        return null;
    }
}
