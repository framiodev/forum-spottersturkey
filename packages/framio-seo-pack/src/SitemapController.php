<?php

namespace Framio\SeoPack;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Framio\SeoPack\Support\SeoSettings;
use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class SitemapController implements RequestHandlerInterface
{
    public function __construct(protected SeoSettings $seo)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (!$this->seo->bool('enable_sitemap')) {
            return new TextResponse('Sitemap is disabled.', 404);
        }

        $baseUrl = $this->seo->baseUrl();

        // /sitemap_index.xml: sayfa ve görsel sitemap'lerini listeleyen dizin
        if (str_ends_with($request->getUri()->getPath(), 'sitemap_index.xml')) {
            $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
                . '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n"
                . '<sitemap><loc>' . htmlspecialchars($baseUrl . '/sitemap.xml', ENT_XML1) . '</loc></sitemap>' . "\n";
            if ($this->seo->bool('enable_image_sitemap')) {
                $xml .= '<sitemap><loc>' . htmlspecialchars($baseUrl . '/sitemap-images.xml', ENT_XML1) . '</loc></sitemap>' . "\n";
            }
            if ($this->seo->bool('enable_post_pages')) {
                $files = resolve(PostSitemapController::class)->fileCount();
                for ($i = 1; $i <= $files; $i++) {
                    $xml .= '<sitemap><loc>' . htmlspecialchars($baseUrl . '/sitemap-posts.xml' . ($i > 1 ? '?page=' . $i : ''), ENT_XML1) . '</loc></sitemap>' . "\n";
                }
            }
            if ($this->seo->bool('enable_hubs')) {
                $xml .= '<sitemap><loc>' . htmlspecialchars($baseUrl . '/sitemap-hubs.xml', ENT_XML1) . '</loc></sitemap>' . "
";
            }
            $xml .= '</sitemapindex>';

            return new TextResponse($xml, 200, ['Content-Type' => 'application/xml; charset=utf-8', 'X-Robots-Tag' => 'noindex']);
        }

        $urls = [];

        // Misafir yetkisiyle: kısıtlı etiketlerdeki konular sitemap'e girmez
        $discussions = Discussion::whereVisibleTo(new \Flarum\User\Guest())
            // Yalnızca açıklama mesajı olan (henüz paylaşım gelmemiş) başlıklar bildirilmez: sayfada noindex alırlar
            ->where('discussions.comment_count', '>=', max(1, $this->seo->int('discussion_min_posts')))
            ->orderBy('discussions.last_posted_at', 'desc')
            ->limit(45000)
            ->get(['discussions.id', 'discussions.slug', 'discussions.created_at', 'discussions.last_posted_at']);

        $latest = $discussions->first()?->last_posted_at;

        // Ana sayfa: son değişiklik = en son mesaj tarihi (her istekte "şimdi" değil)
        $urls[] = [$baseUrl, $latest, '1.0'];

        if (class_exists(\Flarum\Tags\Tag::class)) {
            $tags = \Flarum\Tags\Tag::where(fn ($q) => $q->whereNull('is_hidden')->orWhere('is_hidden', false))
                ->where(fn ($q) => $q->whereNull('is_restricted')->orWhere('is_restricted', false))
                ->orderBy('position')
                ->get(['slug', 'parent_id', 'last_posted_at']);

            foreach ($tags as $tag) {
                $urls[] = [$baseUrl . '/t/' . $tag->slug, $tag->last_posted_at, $tag->parent_id ? '0.7' : '0.8'];
            }
        }

        foreach ($discussions as $d) {
            $modified = $d->last_posted_at ?: $d->created_at;
            $age = $modified ? $modified->diffInDays(Carbon::now()) : 999;
            $urls[] = [$baseUrl . '/d/' . $d->id . ($d->slug ? '-' . $d->slug : ''), $modified, $age <= 7 ? '0.9' : ($age <= 90 ? '0.7' : '0.5')];
        }

        // Yeterli içeriği olan üye profilleri (fotoğrafçı sayfaları)
        $minPosts = max(1, $this->seo->int('profile_min_posts'));
        $users = \Flarum\User\User::where('comment_count', '>=', $minPosts)
            ->whereNotNull('is_email_confirmed')->where('is_email_confirmed', true)
            ->orderBy('comment_count', 'desc')
            ->limit(5000)
            ->get(['username', 'last_seen_at', 'joined_at']);
        foreach ($users as $u) {
            $urls[] = [$baseUrl . '/u/' . rawurlencode($u->username), null, '0.4'];
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
            . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

        foreach ($urls as [$loc, $lastmod, $priority]) {
            $xml .= '<url><loc>' . htmlspecialchars($loc, ENT_XML1, 'UTF-8') . '</loc>';
            if ($lastmod) {
                $xml .= '<lastmod>' . $lastmod->toAtomString() . '</lastmod>';
            }
            $xml .= '<priority>' . $priority . '</priority></url>' . "\n";
        }

        $xml .= '</urlset>';

        return new TextResponse($xml, 200, [
            'Content-Type' => 'application/xml; charset=utf-8',
            'Cache-Control' => 'public, max-age=900',
            'X-Robots-Tag' => 'noindex',
        ]);
    }
}
