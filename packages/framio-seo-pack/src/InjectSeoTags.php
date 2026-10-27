<?php

namespace Framio\SeoPack;

use Flarum\Discussion\Discussion;
use Flarum\Frontend\Document;
use Flarum\Post\CommentPost;
use Framio\SeoPack\Helpers\MediaTagParser;
use Framio\SeoPack\Support\PostPages;
use Framio\SeoPack\Support\SeoSettings;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Log\LoggerInterface;

class InjectSeoTags
{
    private string $lang = 'tr';

    public function __construct(
        protected SeoSettings $seo,
        protected ConnectionInterface $db,
        protected LoggerInterface $log
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request)
    {
        $this->injectGlobalTags($document);

        $uri = $request->getUri()->getPath();
        $query = $request->getQueryParams();

        // Forum içi arama sonuçları dizine girmemeli (sonsuz URL varyantı)
        if (!empty($query['q'])) {
            $document->meta['robots'] = 'noindex, follow';
        }

        try {
            if (preg_match('#^/d/(\d+)#', $uri, $m)) {
                $postNumber = preg_match('#^/d/[^/]+/(\d+)#', $uri, $pm) ? (int) $pm[1] : null;
                $this->injectDiscussionTags($document, (int) $m[1], $postNumber);
            } elseif (preg_match('#^/t/([^/]+)#', $uri, $m)) {
                $this->injectTagTags($document, rawurldecode($m[1]));
            } elseif ($uri === '/' || $uri === '' || $uri === '/all') {
                $this->injectHomeTags($document, $uri);
            } elseif (preg_match('#^/u/([^/]+)$#', $uri, $m)) {
                $this->injectProfileTags($document, rawurldecode($m[1]));
            }
        } catch (\Throwable $e) {
            // Hata ayrıntısı HTML'e değil, forum günlüğüne yazılır
            $this->log->warning('[framio/seo-pack] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        }

        // Dizinlenebilir her sayfada büyük görsel önizlemesine izin ver
        // (Google Görseller ve Discover büyük küçük resim gösterebilsin)
        if (empty($document->meta['robots'])) {
            $document->meta['robots'] = 'index, follow, max-image-preview:large, max-snippet:-1';
        }

        $this->moveOpenGraphToProperty($document);
    }

    /**
     * Flarum tüm meta etiketlerini name="…" ile basar; Open Graph protokolü
     * (Facebook, LinkedIn, WhatsApp) ise property="…" ister.
     */
    private function moveOpenGraphToProperty(Document $document): void
    {
        foreach ($document->meta as $key => $value) {
            if (preg_match('/^(og|article):/', $key)) {
                if ($value !== null && $value !== '') {
                    $document->head[] = '<meta property="' . e($key) . '" content="' . e($value) . '">';
                }
                unset($document->meta[$key]);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────── Genel

    private function injectGlobalTags(Document $document): void
    {
        // Son paylaşımlar akışı (WebSub ile hızlı keşif)
        $document->head[] = '<link rel="alternate" type="application/atom+xml" title="' . htmlspecialchars($this->seo->siteName(), ENT_QUOTES) . ' – Son paylaşımlar" href="' . $this->seo->baseUrl() . '/feed.xml">';

        if ($code = $this->seo->get('gsc_code')) {
            $document->head[] = '<meta name="google-site-verification" content="' . e($code) . '">';
        }

        if ($gaId = $this->seo->get('ga_id')) {
            $id = e($gaId);
            $document->head[] = "<script async src=\"https://www.googletagmanager.com/gtag/js?id={$id}\"></script>"
                . "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','{$id}');</script>";
        }

        if ($keywords = $this->seo->get('meta_keywords')) {
            $document->meta['keywords'] = $keywords;
        }

        $document->meta['og:site_name'] = $this->seo->siteName();
        $this->lang = $document->language ?: 'tr';
        $lang = str_replace('-', '_', $this->lang);
        $document->meta['og:locale'] = str_contains($lang, '_') ? $lang : $lang . '_' . strtoupper($lang);
    }

    private function jsonLd(Document $document, array $data): void
    {
        $document->head[] = '<script type="application/ld+json">'
            . json_encode(self::withoutNulls($data), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG)
            . '</script>';
    }

    /** Boş (null) şema alanları çıktıya yazılmaz; doğrulayıcılar null değerleri hata sayar */
    public static function withoutNulls(array $data): array
    {
        foreach ($data as $k => $v) {
            if ($v === null) {
                unset($data[$k]);
            } elseif (is_array($v)) {
                $data[$k] = self::withoutNulls($v);
            }
        }

        return $data;
    }

    private function homeCrumb(): array
    {
        return ['@type' => 'ListItem', 'position' => 1, 'name' => $this->seo->get('breadcrumb_home_label'), 'item' => $this->seo->baseUrl()];
    }

    private function organization(): array
    {
        $org = ['@type' => 'Organization', 'name' => $this->seo->siteName(), 'url' => $this->seo->baseUrl()];
        if ($logo = $this->seo->logoUrl()) {
            $org['logo'] = ['@type' => 'ImageObject', 'url' => $logo];
        }
        if ($links = $this->seo->socialLinks()) {
            $org['sameAs'] = $links;
        }

        return $org;
    }

    // ─────────────────────────────────────────────────────────── Ana sayfa

    private function injectHomeTags(Document $document, string $uri): void
    {
        $baseUrl = $this->seo->baseUrl();
        $pageUrl = $uri === '/all' ? $baseUrl . '/all' : $baseUrl;
        $description = $this->seo->core('forum_description') ?: $this->seo->get('meta_description_prefix');
        $description = $this->cleanText(SeoSettings::fill($description, ['site_name' => $this->seo->siteName(), 'excerpt' => '']));

        $document->canonicalUrl = $pageUrl;
        $document->meta['og:type'] = 'website';
        $document->meta['og:url'] = $pageUrl;
        $document->meta['og:title'] = $this->seo->siteName();


        if ($description) {
            $document->meta['description'] = $description;
            $document->meta['og:description'] = $description;
        }
        if ($logo = $this->seo->logoUrl()) {
            $document->meta['og:image'] = $logo;
        }

        $this->jsonLd($document, [
            '@context' => 'https://schema.org',
            '@type' => 'WebSite',
            'name' => $this->seo->siteName(),
            'alternateName' => $this->seo->alternateNames() ?: null,
            'url' => $baseUrl . '/',
            'inLanguage' => $this->lang,
            'publisher' => $this->organization(),
            'potentialAction' => [
                '@type' => 'SearchAction',
                'target' => ['@type' => 'EntryPoint', 'urlTemplate' => $baseUrl . '/?q={search_term_string}'],
                'query-input' => 'required name=search_term_string',
            ],
        ]);
        $this->jsonLd($document, ['@context' => 'https://schema.org'] + $this->organization());
        $this->homeLatestBlock($document);

        // Öne çıkan bölümler: Google'a ana gezinme yapısını açıkça bildirir (alt bağlantı adaylarını güçlendirir)
        if ($nav = $this->featuredNavigation()) {
            $this->jsonLd($document, [
                '@context' => 'https://schema.org',
                '@type' => 'ItemList',
                'name' => $this->seo->siteName(),
                'itemListElement' => array_map(fn ($item, $i) => [
                    '@type' => 'SiteNavigationElement',
                    'position' => $i + 1,
                    'name' => $item['name'],
                    'description' => $item['description'] ?: null,
                    'url' => $item['url'],
                ], $nav, array_keys($nav)),
            ]);
        }
    }

    /**
     * Ana sayfanın botlara görünen "Son paylaşımlar" bloğu. Ana sayfadaki "Son Gönderilen Mesajlar" ve galeri
     * tarayıcıda JavaScript ile oluştuğu için Googlebot ilk taramada hiçbir paylaşım bağlantısı görmüyordu;
     * yeni mesaj sayfaları bu blokla ana sayfanın her taramasında keşfedilir.
     */
    private function homeLatestBlock(Document $document): void
    {
        $items = resolve(\Framio\SeoPack\Support\LatestPosts::class)->get(max(1, $this->seo->int('home_latest_count') ?: 30));
        if (!$items) return;
        $e = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $html = '<section class="container"><h2>Son paylaşımlar</h2><ul>';
        foreach ($items as $it) {
            $html .= '<li><a href="' . $e($it['url']) . '">'
                . ($it['image'] ? '<img src="' . $e($it['image']) . '" alt="' . $e($it['title']) . '" loading="lazy" width="480"><br>' : '')
                . $e($it['title']) . '</a>'
                . ($it['lines'] ? ' — ' . $e(implode(' · ', array_slice($it['lines'], 1))) : '')
                . ' <small>' . $e($it['discussion']) . ($it['date'] ? ' · ' . $e($it['date']->format('d.m.Y')) : '') . '</small></li>';
        }
        $html .= '</ul></section>';
        $core = $document->content;
        $document->content = $html . ($core instanceof \Illuminate\Contracts\Support\Renderable ? $core->render() : (string) $core);
    }

    /** @return array<int, array{name: string, description: string, url: string}> */
    public function featuredNavigation(): array
    {
        $slugs = $this->seo->featuredSections();
        if (!$slugs || !class_exists(\Flarum\Tags\Tag::class)) return [];

        $overrides = $this->seo->tagOverrides();
        $tags = \Flarum\Tags\Tag::whereIn('slug', $slugs)->where('is_hidden', false)->get()->keyBy('slug');
        $items = [];
        foreach ($slugs as $slug) {
            if (!($tag = $tags[$slug] ?? null) || $tag->is_restricted) continue;
            $items[] = [
                'name' => trim((string) ($overrides[$slug]['title'] ?? '')) ?: $tag->name,
                'description' => $this->cleanText((string) (($overrides[$slug]['description'] ?? '') ?: ($tag->description ?? ''))),
                'url' => $this->seo->baseUrl() . '/t/' . $tag->slug,
            ];
        }

        return $items;
    }

    // ────────────────────────────────────────────────────────── Etiket sayfası

    private function injectTagTags(Document $document, string $slug): void
    {
        if (!class_exists(\Flarum\Tags\Tag::class)) {
            return;
        }

        $tag = \Flarum\Tags\Tag::where('slug', $slug)->first();
        if (!$tag) {
            return;
        }

        $baseUrl = $this->seo->baseUrl();
        $url = $baseUrl . '/t/' . $tag->slug;

        // Bölüm başlığı: admin'deki bölüm bazlı başlık > başlık şablonu > etiket adı.
        // Güncel / Arşiv gibi aynı adlı alt bölümler şablonla ({parent}) ayrışır.
        $override = $this->seo->tagOverrides()[$tag->slug] ?? [];
        $vars = ['tag' => $tag->name, 'parent' => $this->seo->sectionLabel($tag->parent), 'site_name' => $this->seo->siteName()];
        $pageTitle = trim((string) ($override['title'] ?? '')) ?: trim((string) $this->seo->get('tag_title_template'));
        $pageTitle = $pageTitle !== '' ? $this->cleanText(SeoSettings::fill($pageTitle, $vars)) : $tag->name;
        $pageTitle = trim(preg_replace('/\s*[-–|·]\s*$/u', '', $pageTitle)) ?: $tag->name;

        // Çekirdek <title>'a zaten " - {sonek}" ekliyor; marka tekrar eklenmez.
        $document->title = $pageTitle;
        $document->canonicalUrl = $url;
        $document->meta['og:type'] = 'website';
        $document->meta['og:url'] = $url;
        $document->meta['og:title'] = $pageTitle . ' | ' . $this->seo->siteName();

        $description = $this->cleanText(SeoSettings::fill((string) ($override['description'] ?? ''), $vars)) ?: $this->cleanText($tag->description ?: '');
        if (!$description) {
            $description = $this->cleanText(SeoSettings::fill($this->seo->get('meta_description_prefix'), [
                'site_name' => $this->seo->siteName(), 'title' => $tag->name, 'excerpt' => $tag->name,
            ]));
        }
        if ($description) {
            $document->meta['description'] = $description;
            $document->meta['og:description'] = $description;
        }

        $crumbs = [$this->homeCrumb()];
        if ($tag->parent) {
            $crumbs[] = ['@type' => 'ListItem', 'position' => 2, 'name' => $tag->parent->name, 'item' => $baseUrl . '/t/' . $tag->parent->slug];
        }
        $crumbs[] = ['@type' => 'ListItem', 'position' => count($crumbs) + 1, 'name' => $tag->name, 'item' => $url];

        // Etiketteki en güncel fotoğraf → paylaşım görseli (yoksa logo)
        $pages = resolve(PostPages::class);
        $tagDiscussions = fn ($q) => $q->select('discussion_id')->from('discussion_tag')->where('tag_id', $tag->id);
        $latestPhoto = $pages->query()->whereIn('posts.discussion_id', $tagDiscussions)
            ->orderBy('posts.created_at', 'desc')->limit(5)->get()
            ->first(fn ($p) => (bool) $pages->images($p));
        if ($latestPhoto && ($img = $pages->images($latestPhoto)[0] ?? null)) {
            $imageUrl = MediaTagParser::toProxyUrl($img['url'], $baseUrl, $this->seo->get('sitemap_image_quality'), $this->seo->imageProxyRules(), $this->seo->get('image_proxy_path'));
            $document->meta['og:image'] = $imageUrl;
            $document->meta['og:image:alt'] = $this->cleanText(html_entity_decode($img['alt'] ?? '', ENT_QUOTES)) ?: $tag->name;
            $document->meta['twitter:card'] = 'summary_large_image';
            $document->meta['twitter:image'] = $imageUrl;
        } elseif ($logo = $this->seo->logoUrl()) {
            $document->meta['og:image'] = $logo;
        }

        // Etiketteki güncel konular → ItemList (Google'a sayfanın neyi listelediğini söyler)
        $discussions = Discussion::whereVisibleTo(new \Flarum\User\Guest())
            ->whereIn('discussions.id', $tagDiscussions)
            ->where('comment_count', '>', 0)
            ->orderBy('last_posted_at', 'desc')
            ->limit(20)
            ->get(['discussions.id', 'discussions.slug', 'discussions.title']);

        $this->jsonLd($document, ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $crumbs]);
        $collection = [
            '@context' => 'https://schema.org',
            '@type' => 'CollectionPage',
            'name' => $pageTitle,
            'url' => $url,
            'description' => $description ?: null,
            'inLanguage' => $this->lang,
            'isPartOf' => ['@type' => 'WebSite', 'name' => $this->seo->siteName(), 'url' => $baseUrl],
        ];
        if (!empty($document->meta['og:image'])) {
            $collection['primaryImageOfPage'] = ['@type' => 'ImageObject', 'contentUrl' => $document->meta['og:image']];
        }
        if ($discussions->isNotEmpty()) {
            $collection['mainEntity'] = [
                '@type' => 'ItemList',
                'numberOfItems' => $discussions->count(),
                'itemListElement' => $discussions->values()->map(fn ($d, $i) => [
                    '@type' => 'ListItem',
                    'position' => $i + 1,
                    'name' => $this->cleanText($d->title),
                    'url' => $baseUrl . '/d/' . $d->id . ($d->slug ? '-' . $d->slug : ''),
                ])->all(),
            ];
        }
        $this->jsonLd($document, $collection);
    }

    // ───────────────────────────────────────────────────── Kullanıcı profili

    /**
     * /u/{kullanıcı}: Google'ın forum/topluluk profilleri için desteklediği
     * ProfilePage şeması. Hiç mesajı olmayan profiller dizine girmez (ince içerik).
     */
    private function injectProfileTags(Document $document, string $username): void
    {
        $user = \Flarum\User\User::where('username', $username)->first();
        if (!$user) {
            return;
        }

        $baseUrl = $this->seo->baseUrl();
        $url = $baseUrl . '/u/' . rawurlencode($user->username);
        $name = $user->display_name ?: $user->username;
        $comments = (int) $user->comment_count;
        $discussionsCount = (int) $user->discussion_count;

        if ($comments < max(1, $this->seo->int('profile_min_posts'))) {
            $document->meta['robots'] = 'noindex, follow';
        }

        $bio = $this->cleanText((string) ($user->bio ?? ''));
        $description = Str::limit($bio !== ''
            ? $bio
            : $name . ', ' . $this->seo->siteName() . ' üyesi: ' . $discussionsCount . ' konu, ' . $comments . ' mesaj.', 160, '…');
        $document->meta['description'] = $description;
        $document->meta['og:type'] = 'profile';
        $document->meta['og:url'] = $url;
        $document->meta['og:title'] = $name . ' | ' . $this->seo->siteName();
        $document->meta['og:description'] = $description;
        if ($avatar = $user->avatar_url) {
            $document->meta['og:image'] = $avatar;
        }

        $person = [
            '@type' => 'Person',
            'name' => $name,
            'alternateName' => $user->username,
            'identifier' => (string) $user->id,
            'url' => $url,
            'interactionStatistic' => [
                ['@type' => 'InteractionCounter', 'interactionType' => 'https://schema.org/WriteAction', 'userInteractionCount' => $comments],
            ],
        ];
        if ($avatar ?? null) {
            $person['image'] = $avatar;
        }
        if ($bio !== '') {
            $person['description'] = Str::limit($bio, 300, '…');
        }

        $this->jsonLd($document, [
            '@context' => 'https://schema.org',
            '@type' => 'ProfilePage',
            'url' => $url,
            'dateCreated' => $user->joined_at?->toIso8601String(),
            'mainEntity' => $person,
        ]);
    }

    // ─────────────────────────────────────────────────────── Tartışma sayfası

    private function injectDiscussionTags(Document $document, int $discussionId, ?int $postNumber = null): void
    {
        $apiDocument = $document->payload['apiDocument'] ?? null;

        // Çekirdek tartışmayı ziyaretçinin yetkisine göre yükleyemediyse
        // (gizli/silinmiş/yok) hiçbir bilgi basmıyoruz.
        if (!$apiDocument || (int) ($apiDocument->data->id ?? 0) !== $discussionId) {
            return;
        }

        $discussion = Discussion::with(['user', 'tags'])->find($discussionId);
        if (!$discussion) {
            return;
        }

        $baseUrl = $this->seo->baseUrl();
        $page = max(1, (int) $document->page);

        // Sayfada gerçekten görünen, ziyaretçinin görmeye yetkili olduğu mesajlar
        $visiblePostIds = collect($apiDocument->included ?? [])
            ->filter(fn ($r) => ($r->type ?? null) === 'posts' && isset($r->attributes->contentHtml))
            ->pluck('id')->map(fn ($id) => (int) $id)->all();

        $posts = CommentPost::with('user')->whereIn('id', $visiblePostIds)->orderBy('number')->get();

        // Konunun var olmayan bir sayfası (?page=99): boş sayfa 1. sayfanın
        // kopyası gibi görünmesin
        if ($page > 1 && $posts->isEmpty()) {
            $document->meta['robots'] = 'noindex, follow';
        }
        // Henüz içeriği olmayan başlık (yalnızca açıklama mesajı): ince sayfa dizine girmez, bağlantıları izlenir.
        // İlk paylaşım gelince kendiliğinden dizinlenebilir olur (ayar: discussion_min_posts, varsayılan 2).
        if ((int) $discussion->comment_count < max(1, $this->seo->int('discussion_min_posts'))) {
            $document->meta['robots'] = 'noindex, follow';
        }
        $firstPost = $discussion->first_post_id ? CommentPost::find($discussion->first_post_id) : null;

        // /d/X/N: bu mesaj künyeli / fotoğraflıysa kendi sayfası olarak sunulur
        if ($postNumber && $postNumber > 1) {
            $focal = $posts->firstWhere('number', $postNumber);
            $pages = resolve(PostPages::class);
            if ($focal && $pages->qualifies($focal)) {
                $focal->setRelation('discussion', $discussion);
                $this->injectPostPage($document, $discussion, $focal, $pages);

                return;
            }
        }

        $leadPost =$page === 1 ? ($firstPost ?: $posts->first()) : ($posts->first() ?: $firstPost);

        // Künye (plaka, marka, model…) ilk mesajdan okunur
        $kunye = $firstPost ? MediaTagParser::extractKunyeData($this->rawContent($firstPost), $this->seo->knownBrands()) : [];
        $vars = [
            'title' => $this->cleanText($discussion->title),
            'plate' => $kunye['plate'] ?? '',
            'brand' => $kunye['brand'] ?? '',
            'model' => $kunye['model'] ?? '',
            'company' => $kunye['company'] ?? '',
            'location' => $kunye['location'] ?? '',
            'site_name' => $this->seo->siteName(),
            'forum_title' => $this->seo->siteName(),
            'tag' => $discussion->tags->first()->name ?? '',
        ];

        // Başlık: şablon; çekirdek sonuna " - {forum adı}" ve sayfa numarasını ekler.
        $pageTitle = SeoSettings::fill($this->seo->get('title_format'), $vars) ?: $vars['title'];
        $pageTitle = $this->stripSiteSuffix($pageTitle);

        // Aynı başlık farklı kategorilerde tekrar ediyorsa (Güncel / Arşiv gibi)
        // Google'da ayırt edilebilmesi için ana kategori adını ekle
        if ($this->seo->bool('dedupe_titles') && ($top = $discussion->tags->firstWhere('parent_id', null))
            && Discussion::where('title', $discussion->title)->where('id', '!=', $discussion->id)
                ->where('is_private', false)->whereNull('hidden_at')->exists()) {
            $pageTitle .= ' - ' . $top->name;
        }

        $document->title = $pageTitle;

        // Açıklama: sayfanın ilk mesajının özeti; 1. sayfada şablon öncelikli
        $excerpt = $leadPost ? $this->excerpt($leadPost) : '';
        $vars['excerpt'] = $excerpt;
        $description = '';
        if ($page === 1 && ($template = $this->seo->get('meta_desc_format')) && ($vars['plate'] || $vars['brand'])) {
            $description = SeoSettings::fill($template, $vars);
        }
        if (!$description && $page === 1) {
            // Konuya özgü özet: bölüm + mesaj sayısı + son eklenen araçlar. Aynı adlı konular (Güncel / Arşiv)
            // farklı içerik taşıdığı için açıklamaları da kendiliğinden ayrışır; ilk mesajın kalıp metni kullanılmaz.
            $description = $this->discussionSummary($discussion, $vars['tag']);
        }
        if (!$description) {
            $description = $excerpt ?: SeoSettings::fill($this->seo->get('meta_description_prefix'), $vars);
        }
        $description = Str::limit($this->cleanText($description), 160, '…');

        // Canonical: mesaj numarası (/d/X/N) değil tartışma adresi. Çekirdek
        // buna kendi ?page=P parametresini ekler; böylece /d/X/40, /41, /42
        // aynı sayfayı gösteren tek bir kanonik URL'de birleşir.
        $canonical = $baseUrl . '/d/' . $discussion->id . ($discussion->slug ? '-' . $discussion->slug : '');
        $pageUrl = Document::setPageParam($canonical, $page);
        $document->canonicalUrl = $canonical;

        $document->meta['og:type'] = 'article';
        $document->meta['og:url'] = $pageUrl;
        $document->meta['og:title'] = $pageTitle . ' | ' . $this->seo->siteName();
        $document->meta['twitter:title'] = $document->meta['og:title'];
        if ($description) {
            $document->meta['description'] = $description;
            $document->meta['og:description'] = $description;
            $document->meta['twitter:description'] = $description;
        }
        if ($discussion->created_at) {
            $document->meta['article:published_time'] = $discussion->created_at->toIso8601String();
        }
        if ($discussion->last_posted_at) {
            $document->meta['article:modified_time'] = $discussion->last_posted_at->toIso8601String();
        }

        // Görseller: yalnızca bu sayfada görünen mesajlardakiler
        $images = [];
        $postUrls = [];
        $brands = $this->seo->knownBrands();
        foreach ($posts as $post) {
            $postUrls[$post->id] = $canonical . '/' . $post->number;
            $postImages = $this->extractImages($post);
            if (!$postImages) {
                continue;
            }
            // Her görsel kendi künyesinin aracını taşır (çoklu açıklama); iniş
            // sayfası mesajın kendi kalıcı adresi (/d/X-slug/N)
            foreach ($postImages as $img) {
                $img['post_url'] = $postUrls[$post->id];
                $images[] = $img;
            }
        }
        $images = collect($images)->unique('url')->values()->all();

        if ($images) {
            $ogImage = $this->sizedImage($images[0]['proxy'], (int) ($this->seo->get('og_image_width') ?: 1600));
            $document->meta['og:image'] = $ogImage;
            $document->meta['og:image:alt'] = $images[0]['caption'];
            $document->meta['twitter:image'] = $ogImage;
            $document->meta['twitter:card'] = 'summary_large_image';
        } elseif ($logo = $this->seo->logoUrl()) {
            $document->meta['og:image'] = $logo;
        }

        $this->jsonLd($document, $this->discussionSchema($discussion, $posts, $firstPost, $page, $pageUrl, $canonical, $pageTitle, $description, $images, $postUrls));
        $this->jsonLd($document, $this->discussionBreadcrumb($discussion, $canonical));

        // Her fotoğrafın asıl sayfası kendi mesajıdır: JS'siz içerikte fotoğraf → mesaj sayfası bağlantıları
        // (Google Görseller'den gelen ziyaretçi başlığın başına değil, o fotoğrafın mesajına insin)
        $pages = resolve(PostPages::class);
        $links = [];
        foreach ($posts as $post) {
            if ($post->number > 1 && $pages->qualifies($post) && ($caption = collect($images)->firstWhere('post_url', $postUrls[$post->id])['caption'] ?? null)) {
                $links[$postUrls[$post->id]] = $caption;
            }
        }
        if ($links) {
            $e = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $nav = '<nav class="container"><p>Bu sayfadaki fotoğraflar:</p><ul>';
            foreach ($links as $href => $label) {
                $nav .= '<li><a href="' . $e($href) . '">' . $e($label) . '</a></li>';
            }
            $nav .= '</ul></nav>';
            $core = $document->content;
            $document->content = $nav . ($core instanceof \Illuminate\Contracts\Support\Renderable ? $core->render() : (string) $core);
        }
    }

    /**
     * Künyeli / fotoğraflı tek bir mesajın kalıcı adresi (/d/X-slug/N).
     * SPA'ya dokunulmaz: yalnızca meta etiketleri, yapılandırılmış veri ve
     * JS'siz içeriğin (noscript#flarum-content) başına mesaj bloğu eklenir.
     */
    private function injectPostPage(Document $document, Discussion $discussion, CommentPost $post, PostPages $pages): void
    {
        $base = $this->seo->baseUrl();
        $site = $this->seo->siteName();
        // Çoklu açıklama: mesajda birden çok araç olabilir; başlık ilk araçtan +N
        $vehicles = $pages->vehicles($post);
        $kunye = $vehicles[0] ?? $pages->kunye($post);
        $title = $this->stripSiteSuffix($pages->title($post));
        $url = $pages->url($post);
        $threadUrl = $base . '/d/' . $discussion->id . ($discussion->slug ? '-' . $discussion->slug : '');
        $author = $post->user ? ($post->user->display_name ?: $post->user->username) : $this->seo->defaultAuthor();
        $authorUrl = $post->user ? $base . '/u/' . rawurlencode($post->user->slug ?? $post->user->username) : null;
        $date = $post->created_at;

        // Başlık: "{künye} - {konu}" → çekirdek sonuna " - {forum}" ekler.
        // Sayfa numarası eklenmesin, rel=prev/next üretilmesin: bu tek bir mesaj.
        // (Künye yoksa PostPages::title zaten "{konu} #N" döndürür.)
        $document->title = $title;
        $document->page = 1;
        $document->hasNextPage = false;
        $document->canonicalUrl = $url;

        $lines = array_values(array_filter(array_map(fn ($l) => $this->cleanText($l), $kunye['lines'] ?? [])));
        // Birden çok araç: açıklamada her aracın kısa künyesi
        $descLines = count($vehicles) > 1
            ? array_values(array_filter(array_map(fn ($v) => $this->cleanText($v['title'] ?? ''), $vehicles)))
            : $lines;
        $text = $this->plainText($post);
        $context = $this->cleanText($discussion->title) . ' konusunda ' . $author . ' tarafından' . ($date ? ' ' . $date->format('d.m.Y') . ' tarihinde' : '') . ' paylaşıldı.';
        $description = Str::limit(trim(($descLines ? implode(' · ', $descLines) . '. ' : ($text !== '' ? $text . ' ' : '')) . $context), 160, '…');

        $document->meta['description'] = $description;
        $document->meta['og:type'] = 'article';
        $document->meta['og:url'] = $url;
        $document->meta['og:title'] = $title . ' | ' . $site;
        $document->meta['og:description'] = $description;
        $document->meta['twitter:title'] = $document->meta['og:title'];
        $document->meta['twitter:description'] = $description;
        $document->meta['robots'] = 'index, follow, max-image-preview:large';
        if ($date) {
            $document->meta['article:published_time'] = $date->toIso8601String();
        }
        if ($post->edited_at) {
            $document->meta['article:modified_time'] = $post->edited_at->toIso8601String();
        }

        $images = $this->extractImages($post);
        $vehicleEntities = array_values(array_filter(array_map(fn ($v) => $this->vehicleEntity($v), $vehicles)));
        if ($images) {
            $ogImage = $this->sizedImage($images[0]['proxy'], (int) ($this->seo->get('og_image_width') ?: 1600));
            $document->meta['og:image'] = $ogImage;
            $document->meta['og:image:alt'] = $images[0]['caption'];
            $document->meta['twitter:image'] = $ogImage;
            $document->meta['twitter:card'] = 'summary_large_image';
        }

        // ── Yapılandırılmış veri ──
        $exif = $images ? $pages->exif($images[0]['id'] ?? null) : [];
        $exifFor = fn ($img, $i) => $i === 0 ? $exif : ($i < 12 ? $pages->exif($img['id'] ?? null) : []);
        $showExif = $this->seo->bool('post_show_exif');
        $showGeo = $this->seo->bool('post_show_location');
        $person = ['@type' => 'Person', 'name' => $author] + ($authorUrl ? ['url' => $authorUrl] : []);

        $imageObjects = [];
        $dims = $pages->dimensions(array_column($images, 'id'));
        foreach ($images as $i => $img) {
            $obj = [
                '@type' => 'ImageObject',
                'contentUrl' => $img['proxy'],
                'thumbnailUrl' => $this->sizedImage($img['proxy'], 480),
                'url' => $url,
                'name' => $title,
                'caption' => $img['caption'],
                'author' => $person,
                'creator' => $person,
                'creditText' => $author . ' / ' . $site,
                'copyrightNotice' => '© ' . $author . ' / ' . $site,
                'datePublished' => $date?->toIso8601String(),
            ];
            if ($license = $this->seo->get('license_url')) {
                $obj['license'] = $license;
            }
            if ($acquire = $this->seo->get('acquire_license_url')) {
                $obj['acquireLicensePage'] = $acquire;
            }
            // Fotoğrafa özel Info metni görselin açıklaması olur
            if (!empty($img['info'])) {
                $obj['description'] = Str::limit($this->cleanText($img['info']), 500, '…');
            }
            // Her görsel kendi künyesinin aracı (çoklu açıklama)
            if (!empty($img['vehicle'])) {
                $obj['about'] = $img['vehicle'];
            }
            if (!empty($img['kunye']['title'])) {
                $obj['name'] = $this->cleanText($img['kunye']['title']);
            }
            $imgExif = $exifFor($img, $i);
            if ($showExif && $imgExif) {
                $obj['exifData'] = $this->exifProperties($imgExif);
            }
            if ($showGeo && !empty($imgExif['lat']) && !empty($imgExif['lon'])) {
                $obj['contentLocation'] = ['@type' => 'Place', 'geo' => ['@type' => 'GeoCoordinates', 'latitude' => $imgExif['lat'], 'longitude' => $imgExif['lon']]];
            }
            if (!empty($img['id']) && isset($dims[$img['id']])) {
                [$obj['width'], $obj['height']] = $dims[$img['id']];
            }
            $imageObjects[] = $obj;
        }

        $schema = [
            '@context' => 'https://schema.org',
            '@type' => 'DiscussionForumPosting',
            '@id' => $url,
            'url' => $url,
            'mainEntityOfPage' => $url,
            'headline' => Str::limit($title, 110, ''),
            'text' => $lines ? implode("\n", $lines) . ($text !== '' ? "\n" . Str::limit($text, 800, '…') : '') : Str::limit($text ?: $title, 1000, '…'),
            'author' => $person,
            'datePublished' => $date?->toIso8601String(),
            'dateModified' => ($post->edited_at ?: $date)?->toIso8601String(),
            'inLanguage' => $this->lang,
            // Üst başlık WebPage olarak (DiscussionForumPosting yazılırsa Google yazar/tarih ister ve geçersiz öğe sayar)
            'isPartOf' => ['@type' => 'WebPage', '@id' => $threadUrl, 'url' => $threadUrl, 'name' => $this->cleanText($discussion->title)],
            'publisher' => $this->organization(),
        ];
        if ($imageObjects) {
            $schema['image'] = $imageObjects;
        }
        if ($vehicleEntities) {
            $schema['about'] = count($vehicleEntities) === 1 ? $vehicleEntities[0] : $vehicleEntities;
        }
        $vehicleKeywords = [];
        foreach ($vehicles as $v) {
            $vehicleKeywords[] = $v['plate'] ?? '';
            $vehicleKeywords[] = trim(($v['brand'] ?? '') . ' ' . ($v['model'] ?? ''));
            $vehicleKeywords[] = $v['company'] ?? '';
        }
        $keywords = array_values(array_unique(array_filter(array_merge($vehicleKeywords, $discussion->tags->pluck('name')->all()))));
        if ($keywords) {
            $schema['keywords'] = implode(', ', $keywords);
        }
        $this->jsonLd($document, $schema);

        $crumbs = $this->discussionBreadcrumb($discussion, $threadUrl);
        $crumbs['itemListElement'][] = ['@type' => 'ListItem', 'position' => count($crumbs['itemListElement']) + 1, 'name' => $title, 'item' => $url];
        $this->jsonLd($document, $crumbs);

        // ── JS'siz içerik: mesaj bloğu en başta, çekirdeğin sayfa içeriği ardından ──
        $e = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $html = '<article class="FramioSeo-post" itemscope><div class="container">';
        $html .= '<p><a href="' . $e($threadUrl) . '">' . $e($discussion->title) . '</a></p>';
        $html .= '<h1>' . $e($title) . '</h1>';
        // Görseller, künyelerine göre gruplanır: her grubun hemen altında kendi
        // künyesi ve derleme sayfası bağlantıları (çoklu açıklama)
        $hubs = resolve(\Framio\SeoPack\Support\EntityIndex::class);
        $groups = [];
        foreach ($images as $img) {
            $key = $img['kunye']['title'] ?? '';
            $last = count($groups) - 1;
            if ($last >= 0 && $groups[$last]['key'] === $key) {
                $groups[$last]['images'][] = $img;
            } else {
                $groups[] = ['key' => $key, 'kunye' => $img['kunye'] ?? null, 'images' => [$img]];
            }
        }
        if (!$groups && $lines) {
            $groups[] = ['key' => '', 'kunye' => $kunye, 'images' => []];
        }

        foreach ($groups as $g) {
            foreach ($g['images'] as $img) {
                $html .= '<figure><img src="' . $e($img['proxy']) . '" alt="' . $e($img['caption']) . '"><figcaption>' . $e($img['caption']) . '</figcaption></figure>';
            }
            $gLines = array_values(array_filter(array_map(fn ($l) => $this->cleanText($l), $g['kunye']['lines'] ?? [])));
            if ($gLines) {
                $html .= '<ul>' . implode('', array_map(fn ($l) => '<li><strong>' . $e($l) . '</strong></li>', $gLines)) . '</ul>';
            }
            if ($hubs->enabled() && $g['kunye']) {
                $links = array_map(
                    fn ($ent) => '<a href="' . $e($hubs->url($ent['type'], $ent['slug'])) . '">' . $e($ent['name']) . '</a>',
                    $hubs->fromKunye($g['kunye'])
                );
                if ($links) {
                    $html .= '<p>Diğer fotoğraflar: ' . implode(' · ', $links) . '</p>';
                }
            }
        }
        $html .= '<p>' . ($authorUrl ? '<a href="' . $e($authorUrl) . '" rel="author">' . $e($author) . '</a>' : $e($author))
            . ($date ? ' · <time datetime="' . $e($date->toIso8601String()) . '">' . $e($date->format('d.m.Y')) . '</time>' : '') . '</p>';
        if ($showExif && $exif) {
            $html .= '<p>' . $e(implode(' · ', array_filter([
                trim(($exif['make'] ?? '') . ' ' . ($exif['model'] ?? '')), $exif['lens'] ?? '', $exif['focal'] ?? '',
                $exif['aperture'] ?? '', $exif['exposure'] ?? '', !empty($exif['iso']) ? 'ISO ' . $exif['iso'] : '',
            ]))) . '</p>';
        }
        $html .= '</div></article><hr>';

        // Konunun diğer mesajları yalnızca METİN bağlantısı olarak (görselsiz, içeriksiz). Eskiden çekirdeğin konu
        // sayfası içeriği olduğu gibi eklenirdi; mesaj sayfası konu sayfasıyla büyük ölçüde aynı göründüğü için Google
        // bunları "kopya" sayıp konu sayfasını standart seçiyordu. Artık her mesaj sayfası kendine özgü.
        $others = CommentPost::where('discussion_id', $discussion->id)->where('number', '!=', $post->number)
            ->whereNull('hidden_at')->orderByDesc('number')->limit(40)->get()
            ->filter(fn ($p) => $pages->qualifies($p))->take(12);
        $html .= '<nav class="container"><p>' . $e($discussion->title) . ' başlığındaki diğer paylaşımlar:</p><ul>';
        foreach ($others as $o) {
            $k = $pages->kunye($o);
            $label = $this->cleanText($k['title'] ?? '') ?: ('#' . $o->number);
            $html .= '<li><a href="' . $e($pages->url($o)) . '">' . $e($label) . '</a></li>';
        }
        $html .= '</ul><p><a href="' . $e($threadUrl) . '">Tüm başlığı gör: ' . $e($discussion->title) . '</a></p></nav>';

        $document->content = $html;
    }

    private function exifProperties(array $exif): array
    {
        $map = ['make' => 'Make', 'model' => 'Model', 'lens' => 'LensModel', 'focal' => 'FocalLength', 'aperture' => 'FNumber', 'exposure' => 'ExposureTime', 'iso' => 'ISOSpeedRatings', 'date' => 'DateTimeOriginal'];
        $out = [];
        foreach ($map as $k => $name) {
            if (!empty($exif[$k])) {
                $out[] = ['@type' => 'PropertyValue', 'name' => $name, 'value' => (string) $exif[$k]];
            }
        }

        return $out;
    }

    private function discussionSchema(Discussion $discussion, $posts, ?CommentPost $firstPost, int $page, string $pageUrl, string $canonical, string $headline, string $description, array $images, array $postUrls): array
    {
        $person = function ($user) {
            if (!$user) {
                return ['@type' => 'Person', 'name' => $this->seo->defaultAuthor()];
            }

            return [
                '@type' => 'Person',
                'name' => $user->display_name ?: $user->username,
                'url' => $this->seo->baseUrl() . '/u/' . rawurlencode($user->slug ?? $user->username),
            ];
        };

        $schema = [
            '@context' => 'https://schema.org',
            '@type' => 'DiscussionForumPosting',
            '@id' => $canonical . '#discussion',
            'headline' => Str::limit($headline, 110, ''),
            'url' => $pageUrl,
            'mainEntityOfPage' => $pageUrl,
            'datePublished' => $discussion->created_at?->toIso8601String(),
            'dateModified' => ($discussion->last_posted_at ?: $discussion->created_at)?->toIso8601String(),
            'author' => $person($discussion->user),
            'text' => $firstPost ? Str::limit($this->plainText($firstPost), 1000, '…') : $description,
            'inLanguage' => $this->lang,
            'isPartOf' => ['@type' => 'WebSite', 'name' => $this->seo->siteName(), 'url' => $this->seo->baseUrl()],
            'publisher' => $this->organization(),
            'interactionStatistic' => [
                ['@type' => 'InteractionCounter', 'interactionType' => 'https://schema.org/CommentAction', 'userInteractionCount' => max(0, (int) $discussion->comment_count - 1)],
            ],
        ];

        if ($discussion->tags->isNotEmpty()) {
            $schema['keywords'] = $discussion->tags->pluck('name')->implode(', ');
        }

        // Konunun ilk mesajı tek bir aracı anlatıyorsa tartışmanın konusu odur
        if ($firstPost && ($vehicle = $this->vehicleEntity(resolve(PostPages::class)->kunye($firstPost)))) {
            $schema['about'] = $vehicle;
        }

        // Sayfadaki yanıtlar → comment. Google'ın "Tartışmalar ve forumlar"
        // sonuç özelliği bu yapıyı kullanır.
        $comments = [];
        foreach ($posts as $post) {
            if ($firstPost && $post->id === $firstPost->id) {
                continue;
            }
            $text = $this->plainText($post);
            $comment = [
                '@type' => 'Comment',
                'url' => $postUrls[$post->id] ?? $pageUrl,
                'author' => $person($post->user),
                'datePublished' => $post->created_at?->toIso8601String(),
                'text' => $text !== '' ? Str::limit($text, 500, '…') : ($this->extractImages($post)[0]['caption'] ?? $headline),
            ];
            $comments[] = $comment;
        }
        if ($comments) {
            $schema['comment'] = $comments;
        }

        $maxImages = max(1, $this->seo->int('max_schema_images'));
        $geo = $this->geoForImages(array_slice($images, 0, $maxImages));
        $extraKeywords = $this->seo->get('image_keywords');
        $dims = resolve(PostPages::class)->dimensions(array_column(array_slice($images, 0, $maxImages), 'id'));

        foreach (array_slice($images, 0, $maxImages) as $img) {
            $keywords = array_filter(array_map('trim', preg_split('/[|\/,]+| - /u', $img['caption'])));
            if ($extraKeywords) {
                $keywords = array_merge($keywords, SeoSettings::parseList($extraKeywords));
            }

            $imageSchema = [
                '@type' => 'ImageObject',
                'contentUrl' => $img['proxy'],
                'thumbnailUrl' => $this->sizedImage($img['proxy'], 480),
                'url' => $img['post_url'],
                'caption' => $img['caption'],
                'name' => $img['caption'],
                'creditText' => $this->seo->siteName(),
                'creator' => ['@type' => 'Organization', 'name' => $this->seo->siteName()],
                'copyrightNotice' => $this->seo->siteName(),
            ];
            if ($keywords) {
                $imageSchema['keywords'] = implode(', ', array_unique($keywords));
            }
            if ($license = $this->seo->get('license_url')) {
                $imageSchema['license'] = $license;
            }
            if ($acquire = $this->seo->get('acquire_license_url')) {
                $imageSchema['acquireLicensePage'] = $acquire;
            }
            if (!empty($img['vehicle'])) {
                $imageSchema['about'] = $img['vehicle'];
            }
            if (!empty($img['id']) && isset($dims[$img['id']])) {
                [$imageSchema['width'], $imageSchema['height']] = $dims[$img['id']];
            }
            if (!empty($img['id']) && isset($geo[$img['id']])) {
                $imageSchema['contentLocation'] = [
                    '@type' => 'Place',
                    'geo' => ['@type' => 'GeoCoordinates', 'latitude' => $geo[$img['id']][0], 'longitude' => $geo[$img['id']][1]],
                ];
            }
            $schema['image'][] = $imageSchema;
        }

        return $schema;
    }

    private function discussionBreadcrumb(Discussion $discussion, string $canonical): array
    {
        $baseUrl = $this->seo->baseUrl();
        $items = [$this->homeCrumb()];

        // Ana etiket önce, alt etiket sonra (tek bir hiyerarşik yol)
        $tags = $discussion->tags->sortBy(fn ($t) => $t->parent_id ? 1 : 0);
        foreach ($tags as $tag) {
            $items[] = ['@type' => 'ListItem', 'position' => count($items) + 1, 'name' => $tag->name, 'item' => $baseUrl . '/t/' . $tag->slug];
        }
        $items[] = ['@type' => 'ListItem', 'position' => count($items) + 1, 'name' => $this->cleanText($discussion->title), 'item' => $canonical];

        return ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $items];
    }

    /**
     * Künyeden schema.org araç varlığı. Tür, admin panelindeki niş
     * seçimine göre belirlenir; marka da plaka/tescil de yoksa null döner.
     */
    private function vehicleEntity(array $kunye): ?array
    {
        $brand = trim($kunye['brand'] ?? '');
        $model = trim($kunye['model'] ?? '');
        $plate = trim($kunye['plate'] ?? '');
        if ($brand === '' && $plate === '') {
            return null;
        }

        // niş => [schema türü, Wikidata sınıfı, kimlik etiketi]
        $niches = [
            'bus' => ['BusOrCoach', 'https://www.wikidata.org/wiki/Q5638', 'Plaka'],
            'truck' => ['Vehicle', 'https://www.wikidata.org/wiki/Q43193', 'Plaka'],
            'urban' => ['Vehicle', 'https://www.wikidata.org/wiki/Q178512', 'Plaka / Filo No'],
            'rail' => ['Vehicle', 'https://www.wikidata.org/wiki/Q870', 'Araç No'],
            'aviation' => ['Vehicle', 'https://www.wikidata.org/wiki/Q197', 'Tescil'],
            'maritime' => ['Vehicle', 'https://www.wikidata.org/wiki/Q11446', 'IMO / Tescil'],
            'general' => ['Vehicle', null, 'Plaka / Tescil'],
        ];
        [$type, $class, $idLabel] = $niches[$this->seo->get('niche_mode')] ?? $niches['general'];

        // Vehicle/BusOrCoach schema.org'da Product alt türüdür; Google bunları "Ürün snippet'i" sayıp fiyat/yorum ister
        // ve geçersiz öğe hatası verir. Araç bu yüzden Thing olarak, türü additionalType ile bildirilir.
        $entity = ['@type' => 'Thing', 'name' => trim($brand . ' ' . $model) ?: $plate];
        $entity['additionalType'] = array_values(array_filter(['https://schema.org/' . $type, $class]));
        if ($brand !== '') {
            $entity['brand'] = ['@type' => 'Brand', 'name' => $brand];
        }
        if ($model !== '') {
            $entity['model'] = $model;
        }
        if ($plate !== '') {
            $entity['identifier'] = ['@type' => 'PropertyValue', 'propertyID' => $idLabel, 'value' => $plate];
        }
        if (!empty($kunye['company'])) {
            $entity['description'] = $this->cleanText($kunye['company']);
        }

        return $entity;
    }

    // ───────────────────────────────────────────────────────── Yardımcılar

    private function rawContent(CommentPost $post): string
    {
        // Ham XML yerine düzenlenebilir kaynak metni (BBCode/Markdown)
        try {
            return (string) $post->content;
        } catch (\Throwable $e) {
            return (string) $post->getRawOriginal('content');
        }
    }

    private function extractImages(CommentPost $post): array
    {
        $baseUrl = $this->seo->baseUrl();
        $quality = $this->seo->get('sitemap_image_quality');
        $rules = $this->seo->imageProxyRules();
        $proxyPath = $this->seo->get('image_proxy_path');
        $tags = $this->seo->recognizedTags();

        // Görsel bazında künye (çoklu açıklama): her görsel kendi aracını taşır
        $found = resolve(PostPages::class)->images($post);
        if (!$found) {
            $found = MediaTagParser::extractImages($this->rawContent($post), $baseUrl, $tags, $quality);
        }
        if (!$found) {
            $found = MediaTagParser::extractImages((string) $post->formatContent(), $baseUrl, $tags, $quality);
        }

        $out = [];
        foreach ($found as $img) {
            $alt = $this->cleanText(html_entity_decode($img['alt'] ?? '', ENT_QUOTES | ENT_HTML5));
            // Alt metin boşsa görselin kendi künyesi (çoklu açıklamada her görselin ayrı künyesi)
            if ($alt === '' && !empty($img['kunye']['title'])) {
                $alt = $this->cleanText($img['kunye']['title']);
            }
            $caption = SeoSettings::fill($this->seo->get('image_caption_format'), [
                'alt' => $alt,
                'title' => $this->cleanText($post->discussion->title ?? ''),
                'site_name' => $this->seo->siteName(),
                'host' => $this->seo->host(),
            ]) ?: ($alt ?: $this->cleanText($post->discussion->title ?? ''));

            $kunye = $img['kunye'] ?? null;
            $out[] = [
                'id' => $img['id'] ?? null,
                'url' => $img['url'],
                'proxy' => MediaTagParser::toProxyUrl($img['url'], $baseUrl, $quality, $rules, $proxyPath),
                'caption' => $caption,
                'kunye' => $kunye,
                'vehicle' => $kunye ? $this->vehicleEntity($kunye) : null,
                'info' => $img['info'] ?? '',
            ];
        }

        return $out;
    }

    /** @return array<int,array{0:float,1:float}> görsel id => [lat, lon] (tek sorgu) */
    private function geoForImages(array $images): array
    {
        $ids = array_values(array_filter(array_map(fn ($i) => (int) ($i['id'] ?? 0), $images)));
        $table = $this->seo->mediaTable();
        if (!$ids || !$table || !$this->db->getSchemaBuilder()->hasTable($table)) {
            return [];
        }

        $geo = [];
        foreach ($this->db->table($table)->whereIn('id', $ids)->get(['id', 'exif_data']) as $row) {
            $exif = json_decode($row->exif_data ?? '', true);
            if (!empty($exif['lat']) && !empty($exif['lon'])) {
                $geo[(int) $row->id] = [(float) $exif['lat'], (float) $exif['lon']];
            }
        }

        return $geo;
    }

    private function plainText(CommentPost $post): string
    {
        $html = (string) $post->formatContent();
        // Görsel künye kutuları, alıntılar ve kod blokları özet metne girmesin
        $html = preg_replace('#<(blockquote|script|style|figure)\b.*?</\1>#is', ' ', $html);

        return $this->cleanText(strip_tags(str_replace(['<br>', '<br/>', '<br />', '</p>', '</li>'], ' ', $html)));
    }

    private function excerpt(CommentPost $post): string
    {
        return Str::limit($this->plainText($post), 160, '…');
    }

    /** Markdown/BBCode artıklarını ve fazla boşlukları temizler. */
    private function cleanText(string $text): string
    {
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\[\/?[a-z0-9_-]+(?:[= ][^\]]*)?\]/i', ' ', $text);
        $text = str_replace(['**', '__', '##', '`'], '', $text);
        $text = preg_replace('/^[#>*\-\s]+/m', '', $text);

        return trim(preg_replace('/\s+/u', ' ', $text));
    }

    /** Şablonun sonuna marka eklenmişse kaldırır; çekirdek zaten ekliyor. */
    private function stripSiteSuffix(string $title): string
    {
        $name = preg_quote($this->seo->siteName(), '/');
        $forum = preg_quote($this->seo->core('forum_title'), '/');

        return trim(preg_replace('/\s*[|\-–—]\s*(' . $name . ($forum ? '|' . $forum : '') . ')\s*$/u', '', $title));
    }

    /**
     * Konu sayfası açıklaması: "{bölüm} bölümünde {N} paylaşım. Son eklenenler: {araç}, {araç}, …"
     * Künyesi olmayan konularda boş döner (o zaman mevcut özet kullanılır).
     */
    private function discussionSummary(Discussion $discussion, string $section): string
    {
        $pages = resolve(PostPages::class);
        $recent = [];

        $posts = CommentPost::query()
            ->where('discussion_id', $discussion->id)
            ->where('type', 'comment')
            ->whereNull('hidden_at')
            ->orderByDesc('number')
            ->take(12)
            ->get();

        foreach ($posts as $post) {
            $post->setRelation('discussion', $discussion);
            foreach ($pages->vehicles($post) as $v) {
                $label = trim(implode(' ', array_filter([$v['plate'] ?? '', $v['model'] ?? ($v['brand'] ?? '')])));
                if ($label === '') $label = trim((string) ($v['title'] ?? ''));
                if ($label !== '' && !in_array($label, $recent, true)) $recent[] = $label;
                if (count($recent) >= 4) break 2;
            }
        }

        if (!$recent) {
            return '';
        }

        $count = (int) $discussion->comment_count;
        $head = $this->cleanText($discussion->title) . ($section !== '' ? ' · ' . $section : '')
            . ($count > 1 ? ' · ' . $count . ' paylaşım' : '');

        return $head . '. Son eklenenler: ' . implode(', ', $recent) . '.';
    }
    /**
     * Görsel sunucusu dinamik boyutlandırmayı destekliyorsa (Upload & EXIF: özel görsel alan adı + "CDN dinamik
     * boyutlandırma" açık) verilen genişlikte adres döner; aksi halde adres olduğu gibi kalır.
     */
    private function sizedImage(string $url, int $width): string
    {
        if ($width <= 0 || str_contains($url, '?')) return $url;

        $domain = rtrim((string) $this->seo->core('framio-upload-exif.custom_domain'), '/');
        $dynamic = (bool) $this->seo->core('framio-upload-exif.cdn_dynamic_resize');
        if (!$dynamic || $domain === '' || !str_starts_with($url, $domain . '/')) return $url;

        return $url . '?w=' . $width;
    }
}
