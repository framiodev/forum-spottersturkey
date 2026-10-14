<?php

namespace Framio\SeoPack\Support;

use Flarum\Post\Post;
use Flarum\User\Guest;
use Framio\SeoPack\Helpers\MediaTagParser;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Mesaj sayfaları: Flarum'un kendi kalıcı mesaj adresi (/d/{id}-{slug}/{no})
 * künyeli / fotoğraflı mesajlar için arama motorlarına ayrı bir sayfa olarak
 * sunulur. Ayrı rota yoktur; SPA aynen çalışır, yalnızca sunucu tarafı
 * meta etiketleri ve JS'siz içerik zenginleştirilir.
 *
 * Görünürlük Flarum'un misafir yetkileriyle denetlenir (gizli etiket, onay
 * bekleyen, gizlenmiş mesaj asla bildirilmez).
 */
class PostPages
{
    public function __construct(protected SeoSettings $seo, protected ConnectionInterface $db)
    {
    }

    public function enabled(): bool
    {
        return $this->seo->bool('enable_post_pages');
    }

    /** "media": yalnızca fotoğraflı/künyeli mesajlar, "all": tüm yanıtlar */
    public function scope(): string
    {
        return $this->seo->get('post_sitemap_scope') === 'all' ? 'all' : 'media';
    }

    /** Misafirin görebildiği, ilk mesaj olmayan yorumlar */
    public function query(): Builder
    {
        $q = Post::whereVisibleTo(new Guest())
            ->where('posts.type', 'comment')
            ->where('posts.number', '>', 1);

        if ($this->scope() === 'media') {
            $tags = $this->mediaTags();
            $q->where(function ($w) use ($tags) {
                foreach ($tags as $tag) {
                    $w->orWhere('posts.content', 'like', '%<' . strtoupper($tag) . '%');
                }
                // Görselsiz ama künye listesi olan mesajlar (- **…**)
                $w->orWhere('posts.content', 'like', '%<LI><s>- </s><STRONG>%');
            });
        }

        return $q;
    }

    /**
     * Bu mesaj kendi sayfası olarak bildirilmeye değer mi?
     * (İlk mesaj tartışmanın kendisidir; kendi sayfası olmaz.)
     */
    public function qualifies(Post $post): bool
    {
        if (!$this->enabled() || $post->type !== 'comment' || (int) $post->number <= 1) {
            return false;
        }
        if ($this->scope() === 'all') {
            return true;
        }

        return (bool) $this->images($post) || !empty($this->kunye($post)['lines']);
    }

    /** @return string[] */
    public function mediaTags(): array
    {
        return array_values(array_unique(array_merge(['framio-image', 'upl-image-preview'], $this->seo->recognizedTags())));
    }

    public function raw(Post $post): string
    {
        return html_entity_decode((string) $post->getRawOriginal('content'), ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    /** @var array<int,array> mesaj id => görsel+künye listesi (istek içi önbellek) */
    private array $segments = [];

    /**
     * Görsel bazında künye (çoklu açıklama desteği): her görsel kendi
     * künyesiyle; tek açıklamalı / eski mesajlarda hepsi ortak künyeyi alır.
     *
     * @return array<int,array{image:array,kunye:array}>
     */
    public function imageKunyes(Post $post): array
    {
        return $this->segments[$post->id] ??= MediaTagParser::imagesWithKunye(
            $this->raw($post),
            $this->seo->baseUrl(),
            $this->mediaTags(),
            $this->seo->get('sitemap_image_quality'),
            $this->seo->knownBrands()
        );
    }

    /** Mesajdaki medya eklentisi görselleri (emoji, avatar, dış bağlantı hariç); her biri 'kunye' taşır */
    public function images(Post $post): array
    {
        $segments = $this->imageKunyes($post);

        if (!$segments) {
            // Künye bloğu olmayan mesaj: görseller yine listelenir
            $found = MediaTagParser::extractImages($this->raw($post), $this->seo->baseUrl(), $this->mediaTags(), $this->seo->get('sitemap_image_quality'));
            $found = array_filter($found, fn ($i) => in_array($i['type'] ?? '', ['bbcode', 'xml'], true));

            return array_values(collect($found)->unique('url')->all());
        }

        return array_map(fn ($s) => $s['image'] + ['kunye' => $s['kunye'], 'info' => $s['info'] ?? ''], $segments);
    }

    /** Mesajın (ilk aracın) künyesi */
    public function kunye(Post $post): array
    {
        foreach ($this->imageKunyes($post) as $s) {
            if (!empty($s['kunye']['lines'])) {
                return $s['kunye'];
            }
        }

        return MediaTagParser::extractKunyeData($this->raw($post), $this->seo->knownBrands());
    }

    /**
     * Mesajdaki farklı araçların künyeleri (plaka ya da künye başlığına göre tekil).
     *
     * @return array<int,array>
     */
    public function vehicles(Post $post): array
    {
        $out = [];
        foreach ($this->imageKunyes($post) as $s) {
            $k = $s['kunye'];
            $key = mb_strtolower(trim(($k['plate'] ?? '') ?: ($k['title'] ?? '')));
            if ($key !== '' && !isset($out[$key])) {
                $out[$key] = $k;
            }
        }

        return array_values($out) ?: array_filter([$this->kunye($post)], fn ($k) => !empty($k['lines']));
    }

    /** Mesaj sayfasının başlığı (forum adı eklenmeden) */
    public function title(Post $post, ?array $kunye = null): string
    {
        $extra = 0;
        if ($kunye === null) {
            $vehicles = $this->vehicles($post);
            $kunye = $vehicles[0] ?? $this->kunye($post);
            $extra = max(0, count($vehicles) - 1);
        }

        $base = $this->formatTitle($post, $kunye);

        // Birden çok araç içeren mesaj (çoklu açıklama)
        return $extra > 0 ? $base . ' ve ' . $extra . ' araç daha' : $base;
    }

    private function formatTitle(Post $post, array $kunye): string
    {
        $discussionTitle = (string) ($post->discussion->title ?? '');

        $title = SeoSettings::fill($this->seo->get('post_title_format'), [
            'kunye' => $kunye['title'] ?? '',
            'plate' => $kunye['plate'] ?? '',
            'brand' => $kunye['brand'] ?? '',
            'model' => $kunye['model'] ?? '',
            'company' => $kunye['company'] ?? '',
            'location' => $kunye['location'] ?? '',
            'title' => $discussionTitle,
            'number' => (string) $post->number,
        ]);

        // Künye yoksa konu başlığı + mesaj numarası: yine benzersiz
        return $title !== '' ? $title : $discussionTitle . ' #' . $post->number;
    }

    /** Flarum'un kalıcı mesaj adresi */
    public function url(Post $post): string
    {
        $d = $post->discussion;

        return $this->seo->baseUrl() . '/d/' . $d->id . ($d->slug ? '-' . $d->slug : '') . '/' . $post->number;
    }

    /**
     * Görsel boyutları (tek sorgu). Kullanılan kaliteye göre vitrin ya da
     * küçük görsel boyutu döner.
     *
     * @return array<int,array{0:int,1:int}> görsel id => [genişlik, yükseklik]
     */
    public function dimensions(array $imageIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $imageIds))));
        $table = $this->seo->mediaTable();
        $schema = $this->db->getSchemaBuilder();
        if (!$ids || !$table || !$schema->hasTable($table) || !$schema->hasColumn($table, 'width')) {
            return [];
        }

        $thumb = $this->seo->get('sitemap_image_quality') !== 'original';
        $out = [];
        foreach ($this->db->table($table)->whereIn('id', $ids)->get(['id', 'width', 'height', 'thumb_width', 'thumb_height']) as $r) {
            $w = $thumb && $r->thumb_width ? $r->thumb_width : $r->width;
            $h = $thumb && $r->thumb_height ? $r->thumb_height : $r->height;
            if ($w && $h) {
                $out[(int) $r->id] = [(int) $w, (int) $h];
            }
        }

        return $out;
    }

    /** Medya tablosundaki EXIF verisi */
    public function exif(?int $imageId): array
    {
        $table = $this->seo->mediaTable();
        if (!$imageId || !$table || !$this->db->getSchemaBuilder()->hasTable($table)) {
            return [];
        }
        $row = $this->db->table($table)->where('id', $imageId)->first();
        $exif = $row && !empty($row->exif_data) ? json_decode($row->exif_data, true) : null;

        return is_array($exif) ? array_filter($exif, fn ($v) => $v !== null && $v !== '') : [];
    }
}
