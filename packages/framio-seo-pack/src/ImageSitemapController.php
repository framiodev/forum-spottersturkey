<?php

namespace Framio\SeoPack;

use Flarum\Post\CommentPost;
use Framio\SeoPack\Helpers\MediaTagParser;
use Framio\SeoPack\Support\SeoSettings;
use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Google görsel sitemap'i. Her görsel, sayfada gerçekten göründüğü
 * tartışma sayfasına (?page=P) bağlanır; mesaj numaralı URL'ler kanonik
 * olmadığı için kullanılmaz.
 */
class ImageSitemapController implements RequestHandlerInterface
{
    private const POSTS_PER_PAGE = 20;

    public function __construct(protected SeoSettings $seo)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (!$this->seo->bool('enable_image_sitemap')) {
            return new TextResponse('Image sitemap is disabled.', 404);
        }

        $baseUrl = $this->seo->baseUrl();
        $tags = $this->seo->recognizedTags();
        $quality = $this->seo->get('sitemap_image_quality');
        $rules = $this->seo->imageProxyRules();
        $proxyPath = $this->seo->get('image_proxy_path');

        $pages = [];
        $postPages = resolve(\Framio\SeoPack\Support\PostPages::class);

        // Misafir yetkisiyle: gizli etiket / onay bekleyen / gizlenmiş içerik dışarıda kalır
        \Flarum\Post\Post::whereVisibleTo(new \Flarum\User\Guest())
            ->where('posts.type', 'comment')
            ->with('discussion:id,slug,title,is_private,hidden_at')
            ->where(function ($q) use ($tags) {
                $q->where('content', 'like', '%<IMG %')->orWhere('content', 'like', '%<img %');
                foreach (array_merge($tags, ['framio-image', 'upl-image-preview']) as $tag) {
                    $q->orWhere('content', 'like', '%<' . strtoupper($tag) . '%');
                }
            })
            ->select('posts.*')
            ->orderBy('posts.id')
            ->chunk(500, function ($posts) use (&$pages, $baseUrl, $tags, $quality, $rules, $proxyPath, $postPages) {
                foreach ($posts as $post) {
                    $d = $post->discussion;
                    if (!$d || $d->is_private || $d->hidden_at) {
                        continue;
                    }

                    // Mesaj sayfası olan mesajların görselleri o sayfaya (/d/x/N), diğerleri tartışma sayfasına bağlanır.
                    // (Eskiden mesaj sayfası olanlar atlanıyordu; dosya boş kalıyor ve Search Console hata veriyordu.)
                    if ($post->number > 1 && $postPages->qualifies($post)) {
                        $loc = $postPages->url($post);
                    } else {
                        $page = 1 + intdiv(max(0, (int) $post->number - 1), self::POSTS_PER_PAGE);
                        $loc = $baseUrl . '/d/' . $d->id . ($d->slug ? '-' . $d->slug : '') . ($page > 1 ? '?page=' . $page : '');
                    }

                    // Ham XML doğrudan taranır (unparse etmekten çok daha hızlı);
                    // parser hem <ETIKET url=…> hem <IMG src=…> biçimini tanır.
                    $raw = html_entity_decode((string) $post->getRawOriginal('content'), ENT_QUOTES | ENT_XML1, 'UTF-8');
                    foreach (MediaTagParser::extractImages($raw, $baseUrl, $tags, $quality) as $img) {
                        $pages[$loc]['lastmod'] = max($pages[$loc]['lastmod'] ?? '', $post->created_at?->toAtomString() ?? '');
                        $pages[$loc]['images'][MediaTagParser::toProxyUrl($img['url'], $baseUrl, $quality, $rules, $proxyPath)] = true;
                    }
                }
            });

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
            . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";

        foreach ($pages as $loc => $data) {
            $xml .= '<url><loc>' . htmlspecialchars($loc, ENT_XML1, 'UTF-8') . '</loc>';
            if (!empty($data['lastmod'])) {
                $xml .= '<lastmod>' . $data['lastmod'] . '</lastmod>';
            }
            // Google sayfa başına en fazla 1000 görsel kabul eder
            foreach (array_slice(array_keys($data['images']), 0, 1000) as $imageUrl) {
                $xml .= '<image:image><image:loc>' . htmlspecialchars($imageUrl, ENT_XML1, 'UTF-8') . '</image:loc></image:image>';
            }
            $xml .= '</url>' . "\n";
        }

        $xml .= '</urlset>';

        return new TextResponse($xml, 200, [
            'Content-Type' => 'application/xml; charset=utf-8',
            'Cache-Control' => 'public, max-age=3600',
            'X-Robots-Tag' => 'noindex',
        ]);
    }
}
