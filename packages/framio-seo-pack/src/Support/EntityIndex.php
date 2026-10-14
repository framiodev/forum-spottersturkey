<?php

namespace Framio\SeoPack\Support;

use Flarum\Post\Post;
use Flarum\User\Guest;
use Framio\SeoPack\Helpers\MediaTagParser;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Str;

/**
 * Künye dizini (marka / model / firma / plaka / şehir / yıl) ve derleme sayfalarının verisi.
 * Görünürlük her sorguda Flarum'un misafir yetkisiyle denetlenir.
 */
class EntityIndex
{
    public const TABLE = 'framio_seo_entities';

    /** tür => [adres parçası, tekil etiket, sayfa başlığı şablonu] */
    public const TYPES = [
        'brand' => ['path' => 'marka', 'label' => 'Marka', 'title' => '{name} fotoğrafları'],
        'model' => ['path' => 'model', 'label' => 'Model', 'title' => '{name} fotoğrafları'],
        'company' => ['path' => 'firma', 'label' => 'Firma', 'title' => '{name} filosu ve araç fotoğrafları'],
        'plate' => ['path' => 'plaka', 'label' => 'Plaka / Tescil', 'title' => '{name} plakalı araç fotoğrafları'],
        'city' => ['path' => 'sehir', 'label' => 'Şehir', 'title' => '{name} araç fotoğrafları'],
        'year' => ['path' => 'yil', 'label' => 'Çekim Yılı', 'title' => '{name} yılında çekilen araç fotoğrafları'],
        'place' => ['path' => 'yer', 'label' => 'Çekim Yeri', 'title' => '{name} araç fotoğrafları'],
    ];

    /** Türkiye'nin 81 ili (uzun adlar önce: "Kahramanmaraş" ve "Afyonkarahisar" kısaltmalardan önce eşleşsin) */
    public const PROVINCES = [
        'Afyonkarahisar', 'Kahramanmaraş', 'Şanlıurfa', 'Adana', 'Adıyaman', 'Afyon', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya',
        'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu',
        'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan',
        'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir',
        'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kilis', 'Kocaeli', 'Konya',
        'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize',
        'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van',
        'Yalova', 'Yozgat', 'Zonguldak',
    ];

    /**
     * Görsel adresinin karşılaştırılabilir gövdesi: "…/thumb_1786566666_63%20EG%20563.webp?w=1024"
     * → "1786566666_63 EG 563". Önek, uzantı, sorgu dizesi ve URL kodlaması yok sayılır.
     */
    public static function fileStem(string $url): string
    {
        $name = basename((string) parse_url(html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8'), PHP_URL_PATH));
        $name = preg_replace('/^(thumb_|mini_)/i', '', rawurldecode($name));

        return (string) preg_replace('/\.(jpe?g|webp|png|gif|avif)$/i', '', $name);
    }

    public function __construct(
        protected SeoSettings $seo,
        protected PostPages $pages,
        protected ConnectionInterface $db
    ) {
    }

    public function enabled(): bool
    {
        return $this->seo->bool('enable_hubs');
    }

    public static function typeFromPath(string $path): ?string
    {
        foreach (self::TYPES as $type => $def) {
            if ($def['path'] === $path) {
                return $type;
            }
        }

        return null;
    }

    public function url(string $type, string $slug): string
    {
        return $this->seo->baseUrl() . '/arac/' . self::TYPES[$type]['path'] . '/' . $slug;
    }

    /**
     * Derleme sayfası / künye bağlantısı için gereken en az fotoğraf sayısı.
     * Plaka tek bir araca aittir (çoğu tek fotoğraf): kendi eşiği vardır (varsayılan 1).
     */
    public function minPosts(?string $type = null): int
    {
        if ($type === 'plate') {
            return max(1, $this->seo->int('hub_min_posts_plate'));
        }

        return max(1, $this->seo->int('hub_min_posts'));
    }

    /**
     * Künyenin "Yer / 'Yıl" satırını çözer → [il, yıl, çekim yeri]:
     *   "Ankara / '26"                → ['Ankara', 2026, '']
     *   "Bucak - Burdur / '25"        → ['Burdur', 2025, 'Bucak']
     *   "Antalya Otogar / '26"        → ['Antalya', 2026, 'Antalya Otogar']
     *   "Tesis Adı / Afyonkarahisar / '25" → ['Afyonkarahisar', 2025, 'Tesis Adı']
     *   "O-31 / '24", "Esenler Otogarı / '26" → ['', yıl, 'O-31' / 'Esenler Otogarı']
     * Çekim yeri, künyede yazıldığı haliyle (il parçası çıkarılarak) alınır; böylece metinde birebir eşleşir.
     * İki haneli yıl, bu yıldan büyükse 1900'lere sayılır.
     *
     * @return array{0:string,1:?int,2:string}
     */
    public static function cityYear(string $location): array
    {
        $location = trim(preg_replace('/\s+/u', ' ', strip_tags($location)));
        // Yıl satırın sonundaki son "/" işaretinden sonra gelir
        if (!preg_match('/^(.+)\/\s*[\'’‘`]?\s*(\d{4}|\d{2})\s*\.?$/u', $location, $m)) {
            return ['', null, ''];
        }

        // Yer adının parçaları: " - ", ",", "/", "|" ile ayrılır. Boşluksuz tire ("O-31",
        // "Çanakkale-Küçükkuyu") parçayı bölmez. Ayraçlar korunur ki çekim yeri metindeki haliyle kalsın.
        $norm = fn (string $s) => mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], trim($s)), 'UTF-8');
        $chunks = preg_split('/(\s+[-–]\s+|\s*[,\/|]\s*)/u', trim($m[1]), -1, PREG_SPLIT_DELIM_CAPTURE);
        $segments = [];
        foreach ($chunks as $i => $c) {
            if ($i % 2 === 0 && trim($c) !== '') {
                $segments[$i] = trim($c);
            }
        }

        // İl: sondaki parçalardan başlayarak ara ("Yer - İl" yazımı yaygın)
        $city = '';
        $cityIndex = null;
        foreach (array_reverse($segments, true) as $i => $seg) {
            $lower = $norm($seg);
            foreach (self::PROVINCES as $province) {
                $p = $norm($province);
                if ($lower === $p || str_starts_with($lower, $p . ' ') || str_starts_with($lower, $p . '-') || str_ends_with($lower, ' ' . $p)) {
                    $city = $province === 'Afyon' ? 'Afyonkarahisar' : $province;
                    // Parça yalnızca il adıysa çekim yerinden çıkarılır; "Antalya Otogar" gibi ise yer olarak kalır
                    $cityIndex = $lower === $p ? $i : null;
                    break 2;
                }
            }
        }

        // Çekim yeri: il parçası (ve ondan önceki ayraç) çıkarılmış özgün metin
        if ($cityIndex !== null) {
            unset($chunks[$cityIndex]);
            unset($chunks[$cityIndex > 0 ? $cityIndex - 1 : $cityIndex + 1]);
        }
        $place = trim(implode('', $chunks), " \t-–,/|");
        if ($place !== '' && $norm($place) === $norm($city)) {
            $place = '';
        }
        if (mb_strlen($place) > 60 || !preg_match('/[\p{L}\p{N}]/u', $place)) {
            $place = '';
        }

        $y = (int) $m[2];
        if (strlen($m[2]) === 2) {
            $y += $y <= ((int) date('y')) + 1 ? 2000 : 1900;
        }
        $year = ($y >= 1950 && $y <= (int) date('Y') + 1) ? $y : null;

        return [$city, $year, $place];
    }

    // ────────────────────────────────────────────────────────── Dizinleme

    /**
     * Mesajın görsel bazında varlıkları (çoklu açıklama): her görsel kendi
     * künyesinin marka/model/firma/plakasını taşır.
     *
     * @return array<int,array{type:string,name:string,slug:string,image_url:?string,caption:?string}>
     */
    public function extract(Post $post): array
    {
        $segments = $this->pages->imageKunyes($post);
        if (!$segments) {
            // Görselsiz ya da künyesi bulunamayan mesaj: mesaj geneli künye
            $k = MediaTagParser::extractKunyeData($this->pages->raw($post), $this->seo->knownBrands());
            $img = $this->pages->images($post)[0] ?? null;
            $segments = empty($k['lines']) ? [] : [['image' => $img ?? [], 'kunye' => $k]];
        }

        $out = [];
        foreach ($segments as $s) {
            $imageUrl = $s['image']['url'] ?? null;
            foreach ($this->fromKunye($s['kunye']) as $e) {
                $key = $e['type'] . ':' . $e['slug'] . ':' . $imageUrl;
                $out[$key] = $e + [
                    'image_url' => $imageUrl ? Str::limit($imageUrl, 500, '') : null,
                    'caption' => Str::limit(strip_tags($s['kunye']['title'] ?? ''), 185, ''),
                ];
            }
        }

        return array_values($out);
    }

    /**
     * Tek bir künyenin varlıkları.
     *
     * @return array<int,array{type:string,name:string,slug:string}>
     */
    public function fromKunye(array $k): array
    {
        $out = [];

        $brand = trim($k['brand'] ?? '');
        $model = trim(preg_replace('/\s+/u', ' ', $k['model'] ?? ''));
        $company = trim(preg_replace('/\s+/u', ' ', strip_tags($k['company'] ?? '')), " \t-|,.");
        $plate = trim(preg_replace('/\s+/u', ' ', mb_strtoupper($k['plate'] ?? '', 'UTF-8')));

        if ($brand !== '') {
            $out[] = ['type' => 'brand', 'name' => $brand];
            if ($model !== '' && mb_strlen($model) <= 80) {
                $out[] = ['type' => 'model', 'name' => $brand . ' ' . $model];
            }
        }
        // Firma: plaka ya da çok uzun metin değilse
        if ($company !== '' && mb_strlen($company) <= 60 && !preg_match('/^\d{2}\s*[A-ZÇĞİÖŞÜ]{1,3}\s*\d{2,4}$/u', $company)) {
            $out[] = ['type' => 'company', 'name' => $company];
        }
        if ($plate !== '') {
            $out[] = ['type' => 'plate', 'name' => $plate];
        }

        // Çekim yeri ve yılı ("Ankara / '26")
        [$city, $year, $place] = self::cityYear((string) ($k['location'] ?? ''));
        if ($city !== '') {
            $out[] = ['type' => 'city', 'name' => $city];
        }
        if ($place !== '') {
            $out[] = ['type' => 'place', 'name' => $place];
        }
        if ($year) {
            $out[] = ['type' => 'year', 'name' => (string) $year];
        }

        foreach ($out as &$e) {
            $e['slug'] = Str::limit(Str::slug($e['name']), 180, '');
        }

        return array_values(array_filter($out, fn ($e) => $e['slug'] !== ''));
    }

    public function index(Post $post): void
    {
        $this->db->table(self::TABLE)->where('post_id', $post->id)->delete();

        if ($post->type !== 'comment' || $post->hidden_at) {
            return;
        }

        $rows = [];
        foreach ($this->extract($post) as $e) {
            $rows[] = $e + [
                'post_id' => $post->id,
                'discussion_id' => $post->discussion_id,
                'posted_at' => $post->created_at,
            ];
        }
        if ($rows) {
            $this->db->table(self::TABLE)->insert($rows);
        }
    }

    public function remove(int $postId): void
    {
        $this->db->table(self::TABLE)->where('post_id', $postId)->delete();
    }

    /** Tüm dizini baştan kurar. @return int dizinlenen mesaj sayısı */
    public function rebuild(?callable $progress = null): int
    {
        $this->db->table(self::TABLE)->delete();
        $count = 0;

        Post::query()->where('type', 'comment')->whereNull('hidden_at')
            ->where('content', 'like', '%<LI>%')
            ->orderBy('id')
            ->chunkById(300, function ($posts) use (&$count, $progress) {
                foreach ($posts as $post) {
                    $this->index($post);
                    $count++;
                }
                if ($progress) {
                    $progress($count);
                }
            });

        return $count;
    }

    /**
     * Mesajın künye varlıkları (SPA'da künye kelimelerini derleme
     * sayfalarına bağlamak için). Yalnızca en az bir başka fotoğrafla
     * birlikte anlamlı olan (min. eşik) derlemeler bağlanır.
     *
     * @return array<int,array{type:string,name:string,path:string}>
     */
    public function forPost(int $postId): array
    {
        if (!$this->enabled()) {
            return [];
        }

        $rows = $this->db->table(self::TABLE)->where('post_id', $postId)->get(['type', 'slug', 'name'])
            ->unique(fn ($r) => $r->type . ':' . $r->slug)->values();
        if ($rows->isEmpty()) {
            return [];
        }

        // Künyedeki her bilgi tıklanabilir (tek fotoğraf olsa da). Eşik yalnızca site haritası ve
        // dizine ekleme içindir: eşiğin altındaki sayfalar "noindex, follow" ile açılır (HubContent).
        $out = [];
        foreach ($rows as $r) {
            if (!isset(self::TYPES[$r->type])) {
                continue;
            }
            $item = ['type' => $r->type, 'name' => $r->name, 'path' => '/arac/' . self::TYPES[$r->type]['path'] . '/' . $r->slug];
            // Künyede yıl kısaltılmış yazılır ("'26"): bağlantı bu yazımlarla da eşleşsin
            if ($r->type === 'year') {
                $yy = substr($r->name, -2);
                $item['match'] = [$r->name, "'" . $yy, '’' . $yy, '‘' . $yy];
            }
            $out[] = $item;
        }

        return $out;
    }

    // ─────────────────────────────────────────────────────────── Sorgular

    /** Misafirin görebildiği mesaj id'leri (alt sorgu) */
    private function visiblePostIds()
    {
        return Post::whereVisibleTo(new Guest())->where('posts.type', 'comment')->select('posts.id');
    }

    /**
     * Türe göre derleme listesi (dizin sayfası ve sitemap için).
     *
     * @return array<int,object{type,slug,name,posts,latest}>
     */
    public function listing(?string $type = null, ?int $min = null, int $limit = 5000): array
    {
        $q = $this->db->table(self::TABLE)
            ->whereIn('post_id', $this->visiblePostIds())
            ->whereIn('type', array_keys(self::TYPES))
            ->selectRaw('type, slug, MAX(name) as name, COUNT(*) as posts, MAX(posted_at) as latest')
            ->groupBy('type', 'slug')
            ->orderByDesc('posts')
            ->limit($limit);

        // Eşik verilmediyse türe göre (plaka kendi eşiğiyle)
        if ($min !== null) {
            $q->havingRaw('COUNT(*) >= ?', [$min]);
        } else {
            $q->havingRaw("COUNT(*) >= CASE WHEN type = 'plate' THEN ? ELSE ? END", [$this->minPosts('plate'), $this->minPosts()]);
        }

        if ($type) {
            $q->where('type', $type);
        }

        return $q->get()->all();
    }

    /**
     * Tek bir derleme: başlık + sayfalanmış fotoğraflı mesajlar.
     */
    public function entity(string $type, string $slug, int $page = 1, int $perPage = 24): ?array
    {
        $base = $this->db->table(self::TABLE)
            ->where('type', $type)->where('slug', $slug)
            ->whereIn('post_id', $this->visiblePostIds());

        // Her kart bir mesajdaki bir araç: aynı mesajda aynı künyeli
        // fotoğraflar tek kartta toplanır (kapak: ilk fotoğraf)
        $photos = (clone $base)->count();
        if ($photos === 0) {
            return null;
        }
        $grouped = (clone $base)
            ->selectRaw('post_id, caption, MIN(id) as first_id, MAX(posted_at) as posted, COUNT(*) as n')
            ->groupBy('post_id', 'caption');
        $total = $this->db->query()->fromSub($grouped, 'g')->count();

        $name = (clone $base)->orderByDesc('posted_at')->value('name');
        $groups = (clone $grouped)->orderByDesc('posted')->orderByDesc('first_id')
            ->skip(($page - 1) * $perPage)->take($perPage)->get();
        // Gruptaki bütün fotoğraflar (lightbox için), mesaj içindeki sırayla
        $groupPhotos = [];
        if ($groups->isNotEmpty()) {
            $this->db->table(self::TABLE)->where('type', $type)->where('slug', $slug)
                ->whereIn('post_id', $groups->pluck('post_id')->unique()->all())
                ->orderBy('id')->get(['post_id', 'caption', 'image_url'])
                ->each(function ($r) use (&$groupPhotos) {
                    if ($r->image_url) {
                        $groupPhotos[$r->post_id . '|' . $r->caption][] = $r->image_url;
                    }
                });
        }
        $rows = $groups->map(fn ($g) => (object) [
            'post_id' => $g->post_id,
            'caption' => $g->caption,
            'count' => (int) $g->n,
            'photos' => array_values(array_unique($groupPhotos[$g->post_id . '|' . $g->caption] ?? [])),
        ]);
        foreach ($rows as $r) {
            $r->image_url = $r->photos[0] ?? null;
        }

        // Izgarada 3840px asıllar yerine medya tablosundaki küçük sürümler (+ EXIF)
        // Mesajdaki adres ile medya tablosundaki yol farklı biçimlerde olabilir (thumb_/mini_ öneki,
        // ?w= boyut eki, %20, tam/göreli adres, jpg→webp). Eşleştirme dosya adının gövdesiyle yapılır.
        $media = [];
        $mediaTable = $this->seo->mediaTable();
        $norm = fn ($u) => self::fileStem((string) $u);
        if ($mediaTable && $rows->isNotEmpty()) {
            $stems = $rows->pluck('photos')->flatten()->map($norm)->filter()->unique()->values()->all();
            try {
                $media = $this->db->table($mediaTable)
                    ->where(function ($q) use ($stems) {
                        foreach (array_slice($stems, 0, 200) as $s) {
                            $q->orWhere('path', 'like', '%' . addcslashes($s, '%_\\') . '%');
                        }
                    })
                    ->get(['id', 'path', 'thumb_path', 'exif_data'])
                    ->keyBy(fn ($m) => self::fileStem((string) $m->path))->all();
            } catch (\Throwable $e) {
                $media = [];
            }
        }
        $thumbs = array_filter(array_map(fn ($m) => $m->thumb_path, $media));

        $posts = Post::with(['discussion', 'user'])->whereIn('id', $rows->pluck('post_id')->unique()->all())->get()->keyBy('id');
        $proxy = fn ($url, $q) => MediaTagParser::toProxyUrl($url, $this->seo->baseUrl(), $q, $this->seo->imageProxyRules(), $this->seo->get('image_proxy_path'));

        $items = [];
        foreach ($rows as $row) {
            $post = $posts[$row->post_id] ?? null;
            if (!$post || !$post->discussion) {
                continue;
            }
            $imageUrl = $row->image_url ?: ($this->pages->images($post)[0]['url'] ?? null);
            $caption = $row->caption ?: $this->pages->title($post);
            $thumb = $imageUrl ? ($thumbs[self::fileStem($imageUrl)] ?? null) : null;
            $items[] = [
                'postId' => $post->id,
                'title' => $caption,
                'url' => $post->number > 1
                    ? $this->pages->url($post)
                    : $this->seo->baseUrl() . '/d/' . $post->discussion->id . ($post->discussion->slug ? '-' . $post->discussion->slug : ''),
                'image' => $thumb ? $proxy(str_replace(' ', '%20', $thumb), 'thumb') : ($imageUrl ? $proxy($imageUrl, 'thumb') : null),
                'count' => $row->count,
                'photos' => array_map(function ($u) use ($media, $norm, $proxy) {
                    $m = $media[$norm($u)] ?? null;
                    $exif = $m && $m->exif_data ? json_decode($m->exif_data, true) : null;

                    return [
                        'id' => $m->id ?? null,
                        'url' => $m && $m->thumb_path ? $proxy(str_replace(' ', '%20', $m->thumb_path), 'thumb') : $proxy($u, 'thumb'),
                        'original' => $proxy($u, 'original'),
                        'exif' => is_array($exif) ? $exif : null,
                    ];
                }, $row->photos),
                'imageOriginal' => $imageUrl ? $proxy($imageUrl, 'original') : null,
                'alt' => $caption,
                'discussion' => $post->discussion->title,
                'author' => $post->user ? ($post->user->display_name ?: $post->user->username) : null,
                'date' => $post->created_at?->toIso8601String(),
            ];
        }

        // Bu derlemeyle birlikte en sık geçen diğer derlemeler (iç bağlantı)
        // (Takma adlı self-join tablo önekiyle çakıştığı için iki adımda)
        $entityPostIds = (clone $base)->distinct()->limit(2000)->pluck('post_id')->all();
        $related = $this->db->table(self::TABLE)
            ->whereIn('post_id', $entityPostIds)
            ->whereIn('type', array_keys(self::TYPES))
            ->where(fn ($q) => $q->where('type', '!=', $type)->orWhere('slug', '!=', $slug))
            ->selectRaw('type, slug, MAX(name) as name, COUNT(*) as posts')
            ->groupBy('type', 'slug')
            ->orderByDesc('posts')
            ->limit(24)
            ->get()
            ->map(fn ($r) => ['type' => $r->type, 'slug' => $r->slug, 'name' => $r->name, 'posts' => (int) $r->posts, 'url' => $this->url($r->type, $r->slug)])
            ->all();

        return [
            'type' => $type,
            'path' => self::TYPES[$type]['path'],
            'typeLabel' => self::TYPES[$type]['label'],
            'slug' => $slug,
            'name' => $name,
            'title' => str_replace('{name}', $name, self::TYPES[$type]['title']),
            'url' => $this->url($type, $slug),
            'total' => $total,
            'photos' => $photos,
            'page' => $page,
            'perPage' => $perPage,
            'pages' => (int) ceil($total / $perPage),
            'indexable' => $total >= $this->minPosts($type),
            'items' => $items,
            'related' => $related,
        ];
    }
}
