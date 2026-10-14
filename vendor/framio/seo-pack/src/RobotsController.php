<?php

namespace Framio\SeoPack;

use Framio\SeoPack\Support\SeoSettings;
use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Dinamik robots.txt. Sunucuda fiziksel bir robots.txt dosyası varsa web
 * sunucusu onu doğrudan verir ve bu rota hiç çalışmaz.
 */
class RobotsController implements RequestHandlerInterface
{
    public function __construct(protected SeoSettings $seo)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $base = $this->seo->baseUrl();

        $lines = [
            'User-agent: *',
            'Allow: /',
            'Disallow: /admin',
            'Disallow: /api/',
            'Disallow: /*?q=',
            'Disallow: /*&q=',
            'Disallow: /settings',
            'Disallow: /notifications',
            'Disallow: /reset/',
            'Disallow: /confirm/',
        ];

        if ($extra = trim($this->seo->get('robots_extra'))) {
            $lines[] = '';
            $lines[] = $extra;
        }

        $lines[] = '';
        if ($this->seo->bool('enable_sitemap')) {
            $lines[] = 'Sitemap: ' . $base . '/sitemap.xml';
        }
        if ($this->seo->bool('enable_image_sitemap')) {
            $lines[] = 'Sitemap: ' . $base . '/sitemap-images.xml';
        }
        if ($this->seo->bool('enable_post_pages')) {
            $lines[] = 'Sitemap: ' . $base . '/sitemap-posts.xml';
        }
        if ($this->seo->bool('enable_hubs')) {
            $lines[] = 'Sitemap: ' . $base . '/sitemap-hubs.xml';
        }

        return new TextResponse(implode("\n", $lines) . "\n", 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }
}
