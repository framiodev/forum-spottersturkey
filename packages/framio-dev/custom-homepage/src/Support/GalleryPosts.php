<?php

namespace Framio\CustomHomepage\Support;

use Flarum\Discussion\Discussion;
use Flarum\Http\SlugManager;
use Flarum\Post\CommentPost;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Görselli mesajları toplar ve JSON:API belgesi üretir.
 * Misafir yanıtı önbelleğe alınır (süre admin ayarından); üyeler için
 * görünürlük her seferinde kendi yetkileriyle hesaplanır.
 */
class GalleryPosts
{
    public const CACHE_PREFIX = 'framio_homepage_gallery_';
    public const CACHE_INDEX = 'framio_homepage_gallery_keys';

    public function __construct(
        protected ConnectionInterface $db,
        protected Cache $cache,
        protected SettingsRepositoryInterface $settings,
        protected SlugManager $slugs
    ) {
    }

    public function limit(): int
    {
        return max(12, min(200, (int) $this->settings->get('framio-custom-homepage.gallery_post_limit', 60)));
    }

    public function cacheMinutes(): int
    {
        return max(0, (int) $this->settings->get('framio-custom-homepage.cache_minutes', 5));
    }

    public function document(User $actor, ServerRequestInterface $request, ?string $tag, bool $popular): array
    {
        $build = fn () => $this->build($actor, $request, $tag, $popular);

        if ($this->cacheMinutes() === 0) {
            return $build();
        }

        // Oturum açmış kullanıcılar da önbellekten: aynı gruplardaki herkes aynı mesajları görür
        // (görünürlük grup izinlerine bağlıdır), bu yüzden anahtar grup kümesine göre ayrılır.
        $audience = $actor->isGuest() ? 'guest' : ($actor->isAdmin() ? 'admin' : 'g' . implode('.', $actor->groups->pluck('id')->sort()->values()->all()));
        $key = self::CACHE_PREFIX . md5(json_encode([$tag, $popular, $this->limit(), $audience]));
        $keys = (array) $this->cache->get(self::CACHE_INDEX, []);
        if (!in_array($key, $keys, true)) {
            $keys[] = $key;
            $this->cache->forever(self::CACHE_INDEX, $keys);
        }

        return $this->cache->remember($key, $this->cacheMinutes() * 60, $build);
    }

    /**
     * "Son Gönderilen Mesajlar" tablosu için hafif özet: son 5 tartışma, son mesajın künye özeti ve son 3 yazar.
     * Tam mesaj içerikleri (40 mesaj ~150 KB) yerine birkaç KB; galeriyle aynı önbellek (mesaj eklenince temizlenir).
     */
    public function latest(User $actor): array
    {
        $audience = $actor->isGuest() ? 'guest' : ($actor->isAdmin() ? 'admin' : 'g' . implode('.', $actor->groups->pluck('id')->sort()->values()->all()));
        $key = self::CACHE_PREFIX . 'latest_' . $audience;
        $keys = (array) $this->cache->get(self::CACHE_INDEX, []);
        if (!in_array($key, $keys, true)) {
            $keys[] = $key;
            $this->cache->forever(self::CACHE_INDEX, $keys);
        }

        return $this->cache->remember($key, max(1, $this->cacheMinutes()) * 60, function () use ($actor) {
            $posts = \Flarum\Post\Post::whereVisibleTo($actor)->where('type', 'comment')->whereNull('hidden_at')
                ->orderByDesc('created_at')->limit(60)->with(['user', 'discussion'])->get();
            $groups = [];
            $recent = []; // tartışma → son 24 saatteki mesaj sayısı
            $streak = []; // tartışma → en yeni mesajlardan başlayarak kesintisiz art arda mesaj sayısı
            $prevD = null;
            $runOpen = true;
            $dayAgo = \Carbon\Carbon::now()->subDay();
            foreach ($posts as $post) {
                $d = $post->discussion;
                $u = $post->user;
                if (!$d || !$u) continue;
                if ($post->created_at >= $dayAgo) $recent[$d->id] = ($recent[$d->id] ?? 0) + 1;
                if ($runOpen) {
                    if ($prevD === null || $prevD === $d->id) $streak[$d->id] = ($streak[$d->id] ?? 0) + 1;
                    else $runOpen = false;
                    $prevD = $d->id;
                }
                if (!isset($groups[$d->id])) {
                    if (count($groups) >= 5) continue;
                    $groups[$d->id] = [
                        'discussion' => ['id' => (string) $d->id, 'title' => $d->title, 'slug' => $this->slugs->forResource(\Flarum\Discussion\Discussion::class)->toSlug($d), 'replies' => (int) $d->comment_count - 1],
                        'post' => ['id' => (string) $post->id, 'number' => (int) $post->number],
                        'snippet' => $this->snippet((string) $post->content),
                        'kind' => $this->kind((string) $post->content),
                        'users' => [],
                    ];
                }
                $g = &$groups[$d->id];
                // Son 3 mesajın yazarı (aynı kişi art arda yazdıysa her biri ayrı görünür)
                if (count($g['users']) < 3) {
                    $g['users'][] = ['id' => (string) $u->id, 'username' => $u->username, 'displayName' => $u->display_name, 'avatarUrl' => $u->avatar_url, 'color' => $u->color ?? null,
                        'slug' => $this->slugs->forResource(User::class)->toSlug($u)];
                }
                unset($g);
            }

            // Hareketli konu: son 24 saatte 4+ mesaj ya da en son 3+ mesaj art arda bu konuya
            foreach ($groups as $id => &$g) {
                $g['hot'] = ($recent[$id] ?? 0) >= 4 || ($streak[$id] ?? 0) >= 3;
            }
            unset($g);

            return array_values($groups);
        });
    }

    /** İçerik türü: fotoğraf / video / bağlantı / alıntı / metin */
    private function kind(string $md): string
    {
        if (preg_match('/\[(framio|spotter|ulasimarsiv)[-_]?image|\[upl-image|!\[[^\]]*\]\(|\.(webp|jpe?g|png)\b/i', $md)) return 'photo';
        if (preg_match('#youtube\.com|youtu\.be|vimeo\.com|\.mp4\b|\[video#i', $md)) return 'video';
        if (preg_match('/^>|\[quote|@"/m', $md)) return 'quote';
        if (preg_match('#https?://#i', $md)) return 'link';

        return 'text';
    }

    /** Künye listesinin ilk iki maddesi ("Firma & Plaka"); yoksa "Fotoğraf eklendi" */
    private function snippet(string $xml): string
    {
        // $post->content Flarum'da işlenmemiş metindir (Markdown): "- **Firma**" satırları künyedir
        preg_match_all('/^\s*[-*+]\s+(.+)$/m', $xml, $m);
        $lis = array_values(array_filter(array_map(fn ($x) => trim(html_entity_decode(strip_tags(str_replace(['**', '__'], '', $x)))), $m[1])));
        if (count($lis) >= 2) {
            $company = $lis[0];
            if (str_contains($company, '|')) $company = trim(explode('|', $company)[0]);
            elseif (str_contains($company, ' - ')) $company = trim(explode(' - ', $company)[0]);

            return $company . ' & ' . $lis[1];
        }

        return $lis[0] ?? 'Fotoğraf eklendi';
    }

    /** Mesaj eklenince/düzenlenince ve admin "önbelleği temizle" ile çağrılır */
    public function flush(): void
    {
        foreach ((array) $this->cache->get(self::CACHE_INDEX, []) as $key) {
            $this->cache->forget($key);
        }
        $this->cache->forget(self::CACHE_INDEX);
        $this->cache->forget('framio_spotters_exif_map');
    }

    private function build(User $actor, ServerRequestInterface $request, ?string $tag, bool $popular): array
    {
        $query = Post::whereVisibleTo($actor)
            ->where('posts.type', 'comment')
            ->where(function ($q) {
                foreach ($this->imagePatterns() as $p) {
                    $q->orWhere('posts.content', 'like', $p);
                }
            });

        if ($tag !== null && $tag !== '') {
            $query->whereHas('discussion.tags', fn ($q) => $q->where('slug', $tag));
        }

        if ($popular && $this->db->getSchemaBuilder()->hasTable('post_likes')) {
            $likes = $this->db->table('post_likes')->selectRaw('post_id, COUNT(*) as n')->groupBy('post_id');
            $query->leftJoinSub($likes, 'fl', 'fl.post_id', '=', 'posts.id')
                ->select('posts.*')
                ->orderByDesc('fl.n'); // DESC'de NULL (beğenisiz) sona düşer
        }

        $posts = $query->orderByDesc('posts.created_at')
            ->with(['user', 'discussion'])
            ->limit($this->limit())
            ->get();

        return $this->toDocument($posts, $request);
    }

    /**
     * Mesajları galerinin (ve Keşfet'in) kullandığı JSON:API benzeri belgeye çevirir.
     *
     * @param iterable<Post> $posts
     */
    public function toDocument(iterable $posts, ServerRequestInterface $request, array $extraMeta = []): array
    {
        $data = [];
        $included = [];
        $refs = ['ids' => [], 'urls' => []];
        foreach ($posts as $post) {
            $this->collectImageRefs((string) $post->content, $refs);
            $html = '';
            if ($post instanceof CommentPost) {
                try {
                    $html = $post->formatContent($request);
                } catch (\Throwable $e) {
                    $html = '';
                }
            }

            $rel = [];
            if ($d = $post->discussion) {
                $rel['discussion'] = ['data' => ['type' => 'discussions', 'id' => (string) $d->id]];
                $included['d' . $d->id] = [
                    'type' => 'discussions',
                    'id' => (string) $d->id,
                    'attributes' => [
                        'title' => $d->title,
                        'slug' => $this->slugs->forResource(Discussion::class)->toSlug($d),
                    ],
                ];
            }
            if ($u = $post->user) {
                $rel['user'] = ['data' => ['type' => 'users', 'id' => (string) $u->id]];
                $included['u' . $u->id] = [
                    'type' => 'users',
                    'id' => (string) $u->id,
                    'attributes' => [
                        'username' => $u->username,
                        'displayName' => $u->display_name,
                        'avatarUrl' => $u->avatar_url,
                        'slug' => $this->slugs->forResource(User::class)->toSlug($u),
                    ],
                ];
            }

            $data[] = [
                'type' => 'posts',
                'id' => (string) $post->id,
                'attributes' => [
                    'number' => (int) $post->number,
                    'contentType' => $post->type,
                    'contentHtml' => $html,
                    'createdAt' => $post->created_at?->toIso8601String(),
                    'editedAt' => $post->edited_at?->toIso8601String(),
                    'renderFailed' => false,
                ],
                'relationships' => $rel,
            ];
        }

        return [
            'data' => $data,
            'included' => array_values($included),
            'meta' => ['spotterExifMap' => $this->exifMap($refs)] + $extraMeta,
        ];
    }

    /**
     * Görselli mesajları bulan LIKE kalıpları. Medya etiketleri siteye göre değişir
     * (framio-image, spotter-image, ulasimarsiv-image…): Upload & EXIF'in etkin/tanınan etiketleri
     * ve SEO Pack'in "Tanınan Medya BBCode Etiketleri" varsayılanlara eklenir. Mesajlar veritabanında hem
     * <ETIKET …> (s9e XML) hem [etiket …] biçiminde aranır.
     *
     * @return string[]
     */
    public function imagePatterns(): array
    {
        $tags = ['framio-image', 'spotter-image', 'upl-image-preview'];
        // Upload & EXIF'in etkin ve tanınan etiketleri (asıl kaynak) + SEO Pack'teki ek liste
        foreach (['framio-upload-exif.active_bbcode_tag', 'framio-upload-exif.recognized_bbcode_tags', 'framio-seo.recognized_bbcode_tags'] as $key) {
            $raw = (string) $this->settings->get($key, '');
            $decoded = json_decode($raw, true);
            $extra = is_array($decoded) ? $decoded : preg_split('/[\s,]+/', $raw);
            foreach ((array) $extra as $t) {
                $t = strtolower(trim((string) $t, " \t\n\r[]<>"));
                if ($t !== '' && preg_match('/^[a-z0-9_-]+$/', $t)) {
                    $tags[] = $t;
                }
            }
        }

        $patterns = ['%<img%', '%[img]%', '%![%'];
        foreach (array_unique($tags) as $t) {
            $patterns[] = '%<' . strtoupper($t) . ' %';
            $patterns[] = '%[' . $t . '%';
        }

        return array_values(array_unique($patterns));
    }

    /** Mesaj içeriğindeki görsel kimlikleri (id=123) ve adresleri */
    private function collectImageRefs(string $content, array &$refs): void
    {
        if (preg_match_all('/\bid=["\']?(\d+)/', $content, $m)) {
            foreach ($m[1] as $id) $refs['ids'][(int) $id] = true;
        }
        if (preg_match_all('#https?://[^\s"\'<>\]\[]+?\.(?:webp|jpe?g|png)(?:\?[^\s"\'<>\]\[]*)?#i', $content, $m)) {
            foreach ($m[0] as $u) {
                $u = html_entity_decode($u);
                $refs['urls'][$u] = true;
                $refs['urls'][preg_replace('/\?.*$/', '', $u)] = true;
            }
        }
    }

    /**
     * Görsel → EXIF eşlemesi, YALNIZCA yanıttaki mesajların görselleri için (eskiden son 3000 görselin tamamı
     * gönderiliyordu: 13–37 MB). Galerinin kullanmadığı ağır alanlar (renk profili / ham meta) atılır.
     * Anahtarlar: id_{id}, file_{dosya}, path_{yol}; boyutlar dim_{dosya}.
     */
    private function exifMap(array $refs): array
    {
        $table = preg_replace('/[^A-Za-z0-9_]/', '', (string) $this->settings->get('framio-seo.media_table', 'framio_media_images')) ?: 'framio_media_images';
        $schema = $this->db->getSchemaBuilder();
        if (!$schema->hasTable($table)) {
            $table = $schema->hasTable('spotter_images') ? 'spotter_images' : null;
        }
        $ids = array_keys($refs['ids'] ?? []);
        $urls = array_keys($refs['urls'] ?? []);
        if (!$table || (!$ids && !$urls)) {
            return [];
        }

        $cols = ['id', 'exif_data', 'thumb_path', 'path'];
        $hasDims = $schema->hasColumn($table, 'width');
        if ($hasDims) {
            $cols = array_merge($cols, ['width', 'height']);
        }

        $rows = [];
        foreach (array_chunk($ids, 500) as $chunk) {
            foreach ($this->db->table($table)->whereIn('id', $chunk)->get($cols) as $r) $rows[$r->id] = $r;
        }
        foreach (array_chunk($urls, 300) as $chunk) {
            foreach ($this->db->table($table)->whereIn('path', $chunk)->orWhereIn('thumb_path', $chunk)->get($cols) as $r) $rows[$r->id] = $r;
        }

        // Lightbox'ın gösterdiği alanlar
        $keep = ['make', 'model', 'lens', 'aperture', 'exposure', 'iso', 'focal', 'focal_35mm', 'date', 'lat', 'lon', 'artist', 'copyright', 'description', 'software', 'width', 'height'];
        $map = [];
        foreach ($rows as $img) {
            if (!empty($img->exif_data)) {
                $exif = json_decode((string) $img->exif_data, true);
                $slim = is_array($exif) ? json_encode(array_intersect_key($exif, array_flip($keep)), JSON_UNESCAPED_UNICODE) : $img->exif_data;
                $map['id_' . $img->id] = $slim;
                foreach ([$img->thumb_path, $img->path] as $p) {
                    if ($p) {
                        $map['file_' . basename(preg_replace('/\?.*$/', '', $p))] = $slim;
                        $map['file_' . basename($p)] = $slim;
                    }
                }
                if ($img->thumb_path) {
                    $map['path_' . $img->thumb_path] = $slim;
                }
            }
            if ($hasDims && $img->width && $img->path) {
                $map['dim_' . basename($img->path)] = [(int) $img->width, (int) $img->height];
            }
        }

        return $map;
    }
}
