<?php

namespace Framio\SeoPack;

use Framio\SeoPack\Helpers\MediaTagParser;
use Framio\SeoPack\Support\PostPages;
use Framio\SeoPack\Support\SeoSettings;
use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * /sitemap-posts.xml: künyeli / fotoğraflı her mesaj, Flarum'un kalıcı
 * mesaj adresi (/d/{id}-{slug}/{no}) ve görselleriyle birlikte.
 * 45.000 adres sınırı aşılırsa ?page=2, 3… ile devam eder (sitemap_index listeler).
 */
class PostSitemapController implements RequestHandlerInterface
{
    public const PER_FILE = 45000;

    public function __construct(protected PostPages $posts, protected SeoSettings $seo)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (!$this->posts->enabled()) {
            return new TextResponse('Post sitemap is disabled.', 404);
        }

        $page = max(1, (int) ($request->getQueryParams()['page'] ?? 1));
        $base = $this->seo->baseUrl();
        $rules = $this->seo->imageProxyRules();
        $proxyPath = $this->seo->get('image_proxy_path');

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
            . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";

        $this->posts->query()
            ->with('discussion:id,slug,title,is_private,hidden_at')
            ->select('posts.*')
            ->orderBy('posts.id')
            ->skip(($page - 1) * self::PER_FILE)
            ->take(self::PER_FILE)
            ->get()
            ->each(function ($post) use (&$xml, $base, $rules, $proxyPath) {
                if (!$post->discussion || !$this->posts->qualifies($post)) {
                    return;
                }

                $xml .= '<url><loc>' . htmlspecialchars($this->posts->url($post), ENT_XML1, 'UTF-8') . '</loc>';
                if ($modified = $post->edited_at ?: $post->created_at) {
                    $xml .= '<lastmod>' . $modified->toAtomString() . '</lastmod>';
                }
                foreach (array_slice($this->posts->images($post), 0, 20) as $img) {
                    $loc = MediaTagParser::toProxyUrl($img['url'], $base, 'original', $rules, $proxyPath);
                    $xml .= '<image:image><image:loc>' . htmlspecialchars($loc, ENT_XML1, 'UTF-8') . '</image:loc></image:image>';
                }
                $xml .= "</url>\n";
            });

        $xml .= '</urlset>';

        return new TextResponse($xml, 200, [
            'Content-Type' => 'application/xml; charset=utf-8',
            'Cache-Control' => 'public, max-age=1800',
            'X-Robots-Tag' => 'noindex',
        ]);
    }

    /** sitemap_index için dosya sayısı */
    public function fileCount(): int
    {
        return max(1, (int) ceil($this->posts->query()->count() / self::PER_FILE));
    }
}
