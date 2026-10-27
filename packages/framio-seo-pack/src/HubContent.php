<?php

namespace Framio\SeoPack;

use Flarum\Frontend\Document;
use Flarum\Http\Exception\RouteNotFoundException;
use Framio\SeoPack\Api\Controller\HubController;
use Framio\SeoPack\Support\EntityIndex;
use Framio\SeoPack\Support\SeoSettings;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Psr\Http\Message\ServerRequestInterface;

/**
 * /arac ve /arac/{tür}/{slug} frontend rotalarının sunucu tarafı içeriği.
 * SPA aynı adreste HubPage bileşeniyle çalışır; veriyi app.data.framioHub'dan
 * (ek istek yapmadan) okur. Arama motorları için başlık, meta, şema ve
 * JS'siz içerik (noscript#flarum-content) burada üretilir.
 */
class HubContent
{
    public function __construct(protected EntityIndex $index, protected SeoSettings $seo, protected HubController $api)
    {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): Document
    {
        if (!$this->index->enabled()) {
            throw new RouteNotFoundException();
        }

        $params = $request->getAttribute('routeParameters', []);
        $typePath = Arr::get($params, 'type');

        if ($typePath === null) {
            return $this->indexPage($document);
        }

        $type = EntityIndex::typeFromPath((string) $typePath);
        $page = max(1, (int) Arr::get($request->getQueryParams(), 'page', 1));
        $data = $type ? $this->index->entity($type, (string) Arr::get($params, 'slug'), $page) : null;
        if (!$data || ($page > 1 && !$data['items'])) {
            throw new RouteNotFoundException();
        }

        return $this->entityPage($document, $data);
    }

    private function entityPage(Document $document, array $data): Document
    {
        $site = $this->seo->siteName();
        $e = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $canonical = $data['url'];
        $pageUrl = Document::setPageParam($canonical, $data['page']);

        $document->title = $data['title'];
        $document->canonicalUrl = $canonical;
        $document->page = $data['page'];
        $document->hasNextPage = $data['page'] < $data['pages'];

        $examples = implode(', ', array_slice(array_filter(array_column($data['items'], 'alt')), 0, 2));
        $description = Str::limit($data['name'] . ' için ' . ($data['photos'] ?? $data['total']) . ' fotoğraf: künye, plaka ve çekim bilgileriyle ' . $site . ' arşivinde.'
            . ($examples ? ' ' . $examples : ''), 160, '…');

        $document->meta['description'] = $description;
        $document->meta['og:type'] = 'website';
        $document->meta['og:url'] = $pageUrl;
        $document->meta['og:title'] = $data['title'] . ' | ' . $site;
        $document->meta['og:description'] = $description;
        if (!empty($data['items'][0]['imageOriginal'])) {
            $document->meta['og:image'] = $data['items'][0]['imageOriginal'];
            $document->meta['twitter:card'] = 'summary_large_image';
            $document->meta['twitter:image'] = $data['items'][0]['imageOriginal'];
        }
        // Az fotoğraflı derleme = mesaj sayfasının kopyası; dizine girmesin
        if (!$data['indexable']) {
            $document->meta['robots'] = 'noindex, follow';
        }

        $base = $this->seo->baseUrl();
        $crumbs = [
            ['@type' => 'ListItem', 'position' => 1, 'name' => $this->seo->get('breadcrumb_home_label'), 'item' => $base],
            ['@type' => 'ListItem', 'position' => 2, 'name' => 'Araçlar', 'item' => $base . '/arac'],
            ['@type' => 'ListItem', 'position' => 3, 'name' => $data['typeLabel'], 'item' => $base . '/arac#' . EntityIndex::TYPES[$data['type']]['path']],
            ['@type' => 'ListItem', 'position' => 4, 'name' => $data['name'], 'item' => $canonical],
        ];

        $schema = [
            '@context' => 'https://schema.org',
            '@type' => 'CollectionPage',
            'name' => $data['title'],
            'url' => $pageUrl,
            'description' => $description,
            'isPartOf' => ['@type' => 'WebSite', 'name' => $site, 'url' => $base],
            'breadcrumb' => ['@type' => 'BreadcrumbList', 'itemListElement' => $crumbs],
            'mainEntity' => [
                '@type' => 'ItemList',
                'numberOfItems' => $data['total'],
                'itemListElement' => array_map(fn ($it, $i) => [
                    '@type' => 'ListItem',
                    'position' => ($data['page'] - 1) * $data['perPage'] + $i + 1,
                    'url' => $it['url'],
                    'item' => array_filter([
                        '@type' => 'ImageObject',
                        'name' => $it['title'],
                        'contentUrl' => $it['imageOriginal'],
                        'thumbnailUrl' => $it['image'],
                        'caption' => $it['alt'] ?: $it['title'],
                        'url' => $it['url'],
                        'creator' => $it['author'] ? ['@type' => 'Person', 'name' => $it['author']] : null,
                        'creditText' => $it['author'] ? $it['author'] . ' / ' . $site : $site,
                        'copyrightNotice' => $site,
                        'datePublished' => $it['date'],
                        // Mesaj sayfalarıyla aynı lisans bilgisi (Google Görseller "Lisans ayrıntıları")
                        'license' => $this->seo->get('license_url') ?: null,
                        'acquireLicensePage' => $this->seo->get('acquire_license_url') ?: null,
                    ]),
                ], $data['items'], array_keys($data['items'])),
            ],
        ];
        if ($data['type'] === 'brand' || $data['type'] === 'model') {
            $schema['about'] = ['@type' => 'Brand', 'name' => $data['name']];
        } elseif ($data['type'] === 'company') {
            $schema['about'] = ['@type' => 'Organization', 'name' => $data['name']];
        } elseif ($data['type'] === 'city' || $data['type'] === 'place') {
            $schema['about'] = ['@type' => 'Place', 'name' => $data['name']];
        }
        $document->head[] = '<script type="application/ld+json">' . json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) . '</script>';

        // JS'siz içerik
        $html = '<div class="container"><p><a href="' . $e($base . '/arac') . '">Araçlar</a> › ' . $e($data['typeLabel']) . '</p>'
            . '<h1>' . $e($data['title']) . '</h1><p>' . $e($description) . '</p><ul>';
        foreach ($data['items'] as $it) {
            // Mesajdaki bütün fotoğraflar gerçek görsel olarak (yalnızca ilki değil): görsel aramada her biri bulunur
            $imgs = array_values(array_unique(array_filter(array_column($it['photos'] ?? [], 'url')) ?: array_filter([$it['image']])));
            $html .= '<li><a href="' . $e($it['url']) . '">';
            foreach ($imgs as $src) {
                $html .= '<img src="' . $e($src) . '" alt="' . $e($it['alt'] ?: $it['title']) . '" loading="lazy">';
            }
            $html .= ($imgs ? '<br>' : '') . $e($it['title']) . '</a> — ' . $e($it['discussion']) . '</li>';
        }
        $html .= '</ul>';
        if ($data['page'] > 1) {
            $html .= '<a href="' . $e(Document::setPageParam($canonical, $data['page'] - 1)) . '">« Önceki</a> ';
        }
        if ($data['page'] < $data['pages']) {
            $html .= '<a href="' . $e(Document::setPageParam($canonical, $data['page'] + 1)) . '">Sonraki »</a>';
        }
        if ($data['related']) {
            $html .= '<h2>İlgili</h2><ul>' . implode('', array_map(fn ($r) => '<li><a href="' . $e($r['url']) . '">' . $e($r['name']) . '</a> (' . $r['posts'] . ')</li>', $data['related'])) . '</ul>';
        }
        $html .= '</div>';

        $document->content = $html;
        $document->payload['framioHub'] = $data;

        return $this->ogToProperty($document);
    }

    private function indexPage(Document $document): Document
    {
        $site = $this->seo->siteName();
        $base = $this->seo->baseUrl();
        $e = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $groups = $this->api->groups();

        $document->title = 'Marka, model, firma, plaka, şehir ve yıla göre araç fotoğrafları';
        $document->canonicalUrl = $base . '/arac';
        $description = $site . ' arşivindeki araç fotoğraflarını marka, model, işletmeci firma, plaka, çekim yeri ve yılına göre keşfedin.';
        $document->meta['description'] = $description;
        $document->meta['og:title'] = $document->title . ' | ' . $site;
        $document->meta['og:url'] = $base . '/arac';
        $document->meta['og:description'] = $description;

        $html = '<div class="container"><h1>' . $e($document->title) . '</h1>';
        foreach ($groups as $g) {
            if (!$g['items']) {
                continue;
            }
            $html .= '<h2 id="' . $e($g['path']) . '">' . $e($g['label']) . '</h2><ul>';
            foreach ($g['items'] as $it) {
                $html .= '<li><a href="' . $e($it['url']) . '">' . $e($it['name']) . '</a> (' . $it['posts'] . ')</li>';
            }
            $html .= '</ul>';
        }
        $html .= '</div>';

        $document->content = $html;
        $document->payload['framioHubIndex'] = $groups;

        return $this->ogToProperty($document);
    }

    /** Open Graph etiketleri property="…" ile basılır (Flarum name="…" kullanır). */
    private function ogToProperty(Document $document): Document
    {
        foreach ($document->meta as $key => $value) {
            if (str_starts_with($key, 'og:')) {
                $document->head[] = '<meta property="' . e($key) . '" content="' . e($value) . '">';
                unset($document->meta[$key]);
            }
        }

        return $document;
    }
}
