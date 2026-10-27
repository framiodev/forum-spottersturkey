<?php

namespace Framio\SeoPack;

use Framio\SeoPack\Support\LatestPosts;
use Framio\SeoPack\Support\SeoSettings;
use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * /llms.txt — yapay zekâ arama motorları (ChatGPT, Perplexity, Claude, Gemini) için sitenin özeti:
 * ne olduğu, ana bölümler, araç derleme sayfaları, son paylaşımlar ve kullanım koşulları. İçerik ayarlardan ve
 * veritabanından üretilir; elle yazılmış sabit metin yoktur.
 */
class LlmsTxtController implements RequestHandlerInterface
{
    public function __construct(protected SeoSettings $seo, protected LatestPosts $latest)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $base = $this->seo->baseUrl();
        $desc = trim((string) ($this->seo->core('forum_description') ?: $this->seo->get('meta_description_prefix')));
        $lines = ['# ' . $this->seo->siteName(), ''];
        if ($desc !== '') $lines[] = '> ' . preg_replace('/\s+/', ' ', strip_tags($desc));
        $lines[] = '';

        $nav = resolve(InjectSeoTags::class)->featuredNavigation();
        if ($nav) {
            $lines[] = '## Bölümler';
            foreach ($nav as $n) $lines[] = '- [' . $n['name'] . '](' . $n['url'] . ')' . ($n['description'] ? ': ' . $n['description'] : '');
            $lines[] = '';
        }
        if ($this->seo->bool('enable_hubs')) {
            $lines[] = '## Araç derlemeleri';
            $lines[] = '- [Tüm araçlar: marka, model, firma, plaka, şehir, çekim yeri](' . $base . '/arac): her fotoğraf künyesiyle (firma, plaka, marka/model, çekim yeri ve yılı)';
            $lines[] = '';
        }
        if ($items = $this->latest->get(20)) {
            $lines[] = '## Son paylaşımlar';
            foreach ($items as $it) $lines[] = '- [' . $it['title'] . '](' . $it['url'] . ')' . ($it['lines'] ? ': ' . implode(' · ', $it['lines']) : '');
            $lines[] = '';
        }
        $lines[] = '## Diğer';
        $lines[] = '- [Site haritası](' . $base . '/sitemap_index.xml)';
        $lines[] = '- [Son paylaşımlar akışı](' . $base . '/feed.xml)';
        if ($license = $this->seo->get('license_url')) $lines[] = '- [Fotoğraf kullanım koşulları](' . $license . ')';

        return new TextResponse(implode("\n", $lines) . "\n", 200, ['Content-Type' => 'text/plain; charset=utf-8', 'Cache-Control' => 'public, max-age=3600']);
    }
}
