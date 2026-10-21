<?php

namespace Framio\CustomHomepage\Support;

use Carbon\Carbon;
use Flarum\Post\CommentPost;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Guest;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;

/**
 * Keşfet sayfası (Jetphotos / Buslife tarzı): Günün Fotoğrafı, en popülerler,
 * son eklenenler, koleksiyonlar (araç sayfaları), fotoğrafçılar ve ekipman.
 *
 * Popülerlik puanı = görüntülenme × w_views + beğeni × w_likes + tepki × w_reactions
 * (ağırlıklar admin'den). Sonuçlar önbellekte tutulur.
 */
class Explore
{
    public const P = 'framio-custom-homepage.explore_';
    public const CACHE_INDEX = 'framio_explore_keys';

    public function __construct(
        protected ConnectionInterface $db,
        protected Cache $cache,
        protected SettingsRepositoryInterface $settings,
        protected GalleryPosts $gallery
    ) {
    }

    public function setting(string $key, $default = null)
    {
        $v = $this->settings->get(self::P . $key);

        return ($v === null || $v === '') ? $default : $v;
    }

    protected function weights(): array
    {
        return [
            'views' => (float) $this->setting('w_views', 1),
            'likes' => (float) $this->setting('w_likes', 10),
            'reactions' => (float) $this->setting('w_reactions', 5),
        ];
    }

    /** Günün Fotoğrafı gece 00.00'da yerel saate göre (varsayılan Türkiye) değişir */
    public function now(): Carbon
    {
        return Carbon::now((string) $this->setting('timezone', 'Europe/Istanbul'));
    }

    public function cacheMinutes(): int
    {
        return max(1, (int) $this->setting('cache_minutes', 15));
    }

    protected function remember(string $key, callable $fn)
    {
        $key = 'framio_explore_' . $key;
        $keys = (array) $this->cache->get(self::CACHE_INDEX, []);
        if (!in_array($key, $keys, true)) {
            $keys[] = $key;
            $this->cache->forever(self::CACHE_INDEX, $keys);
        }

        return $this->cache->remember($key, $this->cacheMinutes() * 60, $fn);
    }

    public function flush(): void
    {
        foreach ((array) $this->cache->get(self::CACHE_INDEX, []) as $key) {
            $this->cache->forget($key);
        }
        $this->cache->forget(self::CACHE_INDEX);
    }

    protected function hasTable(string $t): bool
    {
        static $c = [];

        return $c[$t] ??= $this->db->getSchemaBuilder()->hasTable($t);
    }

    /** Misafirin görebildiği görselli yorum mesajları */
    public function imagePosts()
    {
        return Post::whereVisibleTo(new Guest())
            ->where('posts.type', 'comment')
            ->whereNull('posts.hidden_at')
            ->where(function ($q) {
                foreach ($this->gallery->imagePatterns() as $p) {
                    $q->orWhere('posts.content', 'like', $p);
                }
            });
    }

    /** Dönem başlangıcı: day/week/month/year/all */
    public function since(string $period): ?Carbon
    {
        return match ($period) {
            'day' => Carbon::now()->subDay(),
            'week' => Carbon::now()->subWeek(),
            'month' => Carbon::now()->subMonth(),
            'year' => Carbon::now()->subYear(),
            default => null,
        };
    }

    /**
     * Mesaj başına popülerlik puanı.
     *
     * @return array<int, float> post_id => puan (büyükten küçüğe)
     */
    public function scores(?Carbon $from, ?Carbon $to = null, int $limit = 200): array
    {
        $w = $this->weights();
        $scores = [];
        $add = function (iterable $rows, float $weight) use (&$scores) {
            foreach ($rows as $r) {
                $scores[(int) $r->post_id] = ($scores[(int) $r->post_id] ?? 0) + $weight * (int) $r->n;
            }
        };

        // Görüntülenme: dönemliyse günlük kayıttan, tüm zamanlar için toplam sayaçtan
        if ($from && $this->hasTable('framio_view_log')) {
            $q = $this->db->table('framio_view_log')->where('post_id', '>', 0)->where('viewed_on', '>=', $from->toDateString());
            if ($to) $q->where('viewed_on', '<', $to->toDateString());
            $add($q->groupBy('post_id')->selectRaw('post_id, COUNT(*) as n')->get(), $w['views']);
        } elseif (!$from) {
            if ($this->hasTable('framio_post_views')) {
                $add($this->db->table('framio_post_views')->selectRaw('post_id, views as n')->get(), $w['views']);
            }
            // Mesaj başına sayım yeni; eski görüntülenmeler konu sayacında. Konunun
            // görüntülenmesini içindeki fotoğraflı mesajlara eşit paylaştır.
            $add($this->discussionViewShares(), $w['views']);
        }

        foreach (['post_likes' => 'likes', 'post_reactions' => 'reactions'] as $table => $key) {
            if (!$this->hasTable($table)) continue;
            $q = $this->db->table($table)->groupBy('post_id')->selectRaw('post_id, COUNT(*) as n');
            if ($from) $q->where('created_at', '>=', $from);
            if ($to) $q->where('created_at', '<', $to);
            $add($q->get(), $w[$key]);
        }

        if (!$scores) {
            return [];
        }

        // Yalnızca görselli ve herkese açık mesajlar
        $visible = $this->imagePosts()->whereIn('posts.id', array_keys($scores))->pluck('posts.id')->all();
        $scores = array_intersect_key($scores, array_flip($visible));
        arsort($scores);

        return array_slice($scores, 0, $limit, true);
    }

    /** Konu görüntülenmesinin, konudaki fotoğraflı mesaj başına payı */
    protected function discussionViewShares(): array
    {
        if (!$this->db->getSchemaBuilder()->hasColumn('discussions', 'view_count')) {
            return [];
        }
        $rows = $this->imagePosts()->join('discussions as dv', 'dv.id', '=', 'posts.discussion_id')
            ->where('dv.view_count', '>', 0)
            ->select('posts.id', 'posts.discussion_id', 'dv.view_count')->get();
        $per = $rows->countBy('discussion_id');

        return $rows->map(fn ($r) => (object) ['post_id' => $r->id, 'n' => (int) floor($r->view_count / max(1, $per[$r->discussion_id]))])->all();
    }

    /** @return int[] Dönemin en popüler görselli mesajları */
    public function popularIds(string $period, int $limit = 24): array
    {
        return $this->remember('popular_' . $period . '_' . $limit, function () use ($period, $limit) {
            $ids = array_keys($this->scores($this->since($period), null, $limit));
            // Puanlı mesaj azsa listeyi son eklenenlerle tamamla (sayfa boş kalmasın)
            if (count($ids) < $limit) {
                // Dönem içinde paylaşılmış fotoğraflar, tüm zamanların puanına göre
                $since = $this->since($period);
                $pool = $this->imagePosts()->whereNotIn('posts.id', $ids ?: [0])
                    ->when($since, fn ($q) => $q->where('posts.created_at', '>=', $since))
                    ->pluck('posts.id')->all();
                $all = $period === 'all' ? [] : $this->scores(null, null, 100000);
                usort($pool, fn ($a, $b) => (($all[$b] ?? 0) <=> ($all[$a] ?? 0)) ?: $b <=> $a);
                $ids = array_merge($ids, array_slice($pool, 0, $limit - count($ids)));
            }

            return $ids;
        });
    }

    // ── GÜNÜN FOTOĞRAFI ──────────────────────────────────────────────────────

    /**
     * Bugünün fotoğrafı. Her gün 00.00'da önceki 24 saatin (dün) en yüksek puanlı
     * fotoğrafı otomatik seçilir ve gün boyu kalır. Admin o gün için elle seçebilir.
     * Son 30 günde seçilmiş fotoğraflar tekrar seçilmez.
     *
     * @return array{post_id:?int, date:string, source:string, score:float}
     */
    public function potd(): array
    {
        $today = $this->now()->toDateString();

        $manual = json_decode((string) $this->setting('potd_manual', '{}'), true) ?: [];
        if (($manual['date'] ?? '') === $today && !empty($manual['post_id'])) {
            return ['post_id' => (int) $manual['post_id'], 'date' => $today, 'source' => 'manual', 'score' => 0];
        }

        $auto = json_decode((string) $this->setting('potd_auto', '{}'), true) ?: [];
        if (($auto['date'] ?? '') === $today && !empty($auto['post_id'])) {
            return ['post_id' => (int) $auto['post_id'], 'date' => $today, 'source' => 'auto', 'score' => (float) ($auto['score'] ?? 0)];
        }

        [$postId, $score] = $this->pickAuto();
        $this->settings->set(self::P . 'potd_auto', json_encode(['date' => $today, 'post_id' => $postId, 'score' => $score]));
        if ($postId) {
            $history = array_slice(array_values(array_filter((array) json_decode((string) $this->setting('potd_history', '[]'), true))), -60);
            $history[] = ['date' => $today, 'post_id' => $postId];
            $this->settings->set(self::P . 'potd_history', json_encode($history));
        }

        return ['post_id' => $postId, 'date' => $today, 'source' => 'auto', 'score' => $score];
    }

    /** @return array{0:?int, 1:float} */
    protected function pickAuto(): array
    {
        $recent = array_column((array) json_decode((string) $this->setting('potd_history', '[]'), true), 'post_id');
        $recent = array_slice($recent, -30);

        $todayStart = $this->now()->startOfDay();
        // Önce dün (00.00–24.00); boşsa son 7 gün; o da boşsa en yeni fotoğraf
        foreach ([[$todayStart->copy()->subDay(), $todayStart], [$todayStart->copy()->subWeek(), $todayStart]] as [$from, $to]) {
            foreach ($this->scores($from, $to, 50) as $id => $score) {
                if (!in_array($id, $recent)) {
                    return [(int) $id, (float) $score];
                }
            }
        }

        $id = $this->imagePosts()->whereNotIn('posts.id', $recent ?: [0])->orderByDesc('posts.created_at')->value('posts.id');

        return [$id ? (int) $id : null, 0.0];
    }

    /** Admin paneli: bugünün seçimi + dünün aday listesi */
    public function potdCandidates(int $limit = 12): array
    {
        $todayStart = $this->now()->startOfDay();
        $scores = $this->scores($todayStart->copy()->subDay(), $todayStart, $limit);
        if (count($scores) < $limit) {
            $scores += $this->scores($todayStart->copy()->subWeek(), $todayStart, $limit);
        }

        return array_slice($scores, 0, $limit, true);
    }

    public function setManual(?int $postId): void
    {
        $this->settings->set(self::P . 'potd_manual', json_encode($postId ? ['date' => $this->now()->toDateString(), 'post_id' => $postId] : []));
        $this->flush();
    }

    // ── KOLEKSİYONLAR / FOTOĞRAFÇILAR / EKİPMAN ──────────────────────────────

    protected const HUB_PATH = ['brand' => 'marka', 'model' => 'model', 'company' => 'firma', 'plate' => 'plaka', 'city' => 'sehir', 'year' => 'yil', 'place' => 'yer'];

    /** @return array<int, array{type:string,name:string,slug:string,path:string,count:int,image:?string}> */
    public function collections(string $type, int $days = 30, int $limit = 12, string $order = 'count'): array
    {
        if (!$this->hasTable('framio_seo_entities') || !isset(self::HUB_PATH[$type])) {
            return [];
        }

        return $this->remember("coll_{$type}_{$days}_{$limit}_{$order}", function () use ($type, $days, $limit, $order) {
            $q = $this->db->table('framio_seo_entities')->where('type', $type)
                ->groupBy('slug')
                ->selectRaw('slug, MAX(name) as name, COUNT(DISTINCT post_id) as n, MAX(posted_at) as last, MAX(image_url) as image');
            if ($days > 0) {
                $q->where('posted_at', '>=', Carbon::now()->subDays($days));
            }
            $q->when($order === 'new', fn (Builder $b) => $b->orderByDesc('last'), fn (Builder $b) => $b->orderByDesc('n'));

            return $q->limit($limit)->get()->map(fn ($r) => [
                'type' => $type,
                'name' => (string) $r->name,
                'slug' => (string) $r->slug,
                'path' => '/arac/' . self::HUB_PATH[$type] . '/' . $r->slug,
                'count' => (int) $r->n,
                // Kart küçük görünür: tam boy (~1 MB) yerine görsel sunucusunun 480 px sürümü (~25 KB, önceden üretilmiş)
                'image' => $r->image ? (str_contains($r->image, '?') || !preg_match('#^https?://#', $r->image) ? $r->image : $r->image . '?w=480') : null,
            ])->all();
        });
    }

    /** Ayın en aktif fotoğrafçıları (fotoğraflı mesaj sayısı + aldığı beğeniler) */
    public function photographers(int $days = 30, int $limit = 8): array
    {
        return $this->remember("photographers_{$days}_{$limit}", function () use ($days, $limit) {
            $since = $days > 0 ? Carbon::now()->subDays($days) : Carbon::create(2000);
            $rows = $this->imagePosts()->where('posts.created_at', '>=', $since)->whereNotNull('posts.user_id')
                ->groupBy('posts.user_id')->select('posts.user_id')->selectRaw('COUNT(*) as n')
                ->orderByDesc('n')->limit($limit * 2)->get();
            if ($rows->isEmpty()) {
                return $days > 0 ? $this->photographers(0, $limit) : [];
            }

            $likes = [];
            if ($this->hasTable('post_likes')) {
                $likes = $this->db->table('post_likes')->join('posts', 'posts.id', '=', 'post_likes.post_id')
                    ->whereIn('posts.user_id', $rows->pluck('user_id')->all())->where('post_likes.created_at', '>=', $since)
                    ->groupBy('posts.user_id')->select('posts.user_id')->selectRaw('COUNT(*) as n')->pluck('n', 'user_id')->all();
            }

            $users = User::whereIn('id', $rows->pluck('user_id')->all())->get()->keyBy('id');
            $list = [];
            foreach ($rows as $r) {
                $u = $users->get($r->user_id);
                if (!$u) continue;
                $list[] = [
                    'id' => (int) $u->id,
                    'username' => $u->username,
                    'displayName' => $u->display_name,
                    'avatarUrl' => $u->avatar_url,
                    'photos' => (int) $r->n,
                    'likes' => (int) ($likes[$u->id] ?? 0),
                    'postIds' => $this->imagePosts()->where('posts.user_id', $u->id)->orderByDesc('posts.created_at')->limit(3)->pluck('posts.id')->all(),
                ];
            }
            usort($list, fn ($a, $b) => ($b['photos'] + $b['likes'] / 5) <=> ($a['photos'] + $a['likes'] / 5));

            return array_slice($list, 0, $limit);
        });
    }

    /** En çok kullanılan kameralar ve lensler (EXIF) */
    public function equipment(int $limit = 8): array
    {
        if (!$this->hasTable('framio_media_images')) return ['cameras' => [], 'lenses' => []];

        return $this->remember("equipment_{$limit}", function () use ($limit) {
            $cameras = $lenses = [];
            $this->db->table('framio_media_images')->whereNotNull('exif_data')->orderBy('id')
                ->chunk(1000, function ($rows) use (&$cameras, &$lenses) {
                    foreach ($rows as $r) {
                        $e = json_decode((string) $r->exif_data, true);
                        if (!is_array($e)) continue;
                        $cam = trim(trim((string) ($e['make'] ?? '')) . ' ' . trim((string) ($e['model'] ?? '')));
                        // "Canon Canon EOS R6" gibi tekrarları sadeleştir
                        $make = trim((string) ($e['make'] ?? ''));
                        if ($make !== '' && stripos((string) ($e['model'] ?? ''), $make) === 0) $cam = trim((string) $e['model']);
                        if ($cam !== '') $cameras[$cam] = ($cameras[$cam] ?? 0) + 1;
                        $lens = trim((string) ($e['lens'] ?? ''));
                        if ($lens !== '' && $lens !== '-') $lenses[$lens] = ($lenses[$lens] ?? 0) + 1;
                    }
                });
            arsort($cameras);
            arsort($lenses);
            $fmt = fn ($arr) => array_map(fn ($k, $v) => ['name' => $k, 'count' => $v], array_keys($arr), array_values($arr));

            return ['cameras' => array_slice($fmt($cameras), 0, $limit), 'lenses' => array_slice($fmt($lenses), 0, $limit)];
        });
    }

    /**
     * Son eklenenler, filtreli: bölüm (etiket), marka/model/firma/şehir/yıl (araç tablosu).
     *
     * @return int[]
     */
    public function recentIds(array $filter, int $offset = 0, int $limit = 24): array
    {
        $q = $this->imagePosts();
        if (!empty($filter['tag'])) {
            $this->whereTag($q, (string) $filter['tag']);
        }
        foreach (['brand', 'model', 'company', 'city', 'year', 'plate'] as $type) {
            if (!empty($filter[$type]) && $this->hasTable('framio_seo_entities')) {
                $slug = (string) $filter[$type];
                $q->whereIn('posts.id', fn ($s) => $s->select('post_id')->from('framio_seo_entities')->where('type', $type)->where('slug', $slug));
            }
        }

        return $q->orderByDesc('posts.created_at')->offset($offset)->limit($limit)->pluck('posts.id')->all();
    }

    protected function whereTag($q, string $tag)
    {
        return $q->whereHas('discussion.tags', fn ($t) => $t->where('slug', $tag)->orWhereIn('parent_id', fn ($s) => $s->select('id')->from('tags')->where('slug', $tag)));
    }

    /** Filtre seçenekleri: en çok fotoğrafı olan markalar ve şehirler (bölüm seçiliyse o bölümde) */
    public function facets(string $tag = ''): array
    {
        if ($tag !== '') {
            return $this->remember('facets_' . md5($tag), function () use ($tag) {
                $ids = $this->whereTag($this->imagePosts(), $tag)->pluck('posts.id')->all();
                $out = [];
                foreach (['brand' => [30, 'count'], 'city' => [30, 'count'], 'year' => [15, 'new']] as $type => [$limit, $order]) {
                    $q = $this->db->table('framio_seo_entities')->where('type', $type)->whereIn('post_id', $ids ?: [0])
                        ->groupBy('slug')->selectRaw('slug, MAX(name) as name, COUNT(DISTINCT post_id) as n, MAX(posted_at) as last');
                    $order === 'new' ? $q->orderByDesc('last') : $q->orderByDesc('n');
                    $out[$type] = $q->limit($limit)->get()->map(fn ($r) => ['type' => $type, 'name' => (string) $r->name, 'slug' => (string) $r->slug, 'count' => (int) $r->n])->all();
                }

                return $out;
            });
        }

        return [
            'brand' => $this->collections('brand', 0, 30),
            'city' => $this->collections('city', 0, 30),
            'year' => $this->collections('year', 0, 15, 'new'),
        ];
    }

    /** @param int[] $ids Sırayı koruyarak mesajları getir */
    public function postsInOrder(array $ids)
    {
        if (!$ids) return collect();
        $posts = CommentPost::with(['user', 'discussion'])->whereIn('id', $ids)->get()->keyBy('id');

        return collect($ids)->map(fn ($id) => $posts->get($id))->filter()->values();
    }
}
