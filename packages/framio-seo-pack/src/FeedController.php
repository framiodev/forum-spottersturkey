<?php

namespace Framio\SeoPack;

use Framio\SeoPack\Support\LatestPosts;
use Framio\SeoPack\Support\SeoSettings;
use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * /feed.xml — son paylaşımların Atom akışı. WebSub merkezi (hub) bildirildiği için yeni paylaşımda merkeze
 * haber verilir (Listener\PingWebSub); Google akışı abone olarak çeker ve yeni sayfaları hızlı keşfeder.
 */
class FeedController implements RequestHandlerInterface
{
    public const HUB = 'https://pubsubhubbub.appspot.com/';

    public function __construct(protected LatestPosts $latest, protected SeoSettings $seo)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $e = fn ($v) => htmlspecialchars((string) $v, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $base = $this->seo->baseUrl();
        $items = $this->latest->get(50);
        $updated = ($items[0]['date'] ?? null)?->toAtomString() ?? date(DATE_ATOM);

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
            . '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="tr">' . "\n"
            . '<title>' . $e($this->seo->siteName()) . ' – Son paylaşımlar</title>' . "\n"
            . '<id>' . $e($base . '/feed.xml') . '</id>' . "\n"
            . '<link rel="self" href="' . $e($base . '/feed.xml') . '"/>' . "\n"
            . '<link rel="hub" href="' . self::HUB . '"/>' . "\n"
            . '<link rel="alternate" href="' . $e($base . '/') . '"/>' . "\n"
            . '<updated>' . $updated . '</updated>' . "\n";
        foreach ($items as $it) {
            $summary = implode(' · ', $it['lines']) ?: $it['discussion'];
            $html = ($it['image'] ? '<p><img src="' . $e($it['image']) . '" alt="' . $e($it['title']) . '"/></p>' : '') . '<p>' . $e($summary) . '</p>';
            $xml .= '<entry>'
                . '<title>' . $e($it['title']) . '</title>'
                . '<id>' . $e($it['url']) . '</id>'
                . '<link href="' . $e($it['url']) . '"/>'
                . '<updated>' . ($it['date']?->toAtomString() ?? $updated) . '</updated>'
                . ($it['author'] !== '' ? '<author><name>' . $e($it['author']) . '</name></author>' : '')
                . '<category term="' . $e($it['discussion']) . '"/>'
                . '<summary>' . $e($summary) . '</summary>'
                . '<content type="html">' . $e($html) . '</content>'
                . "</entry>\n";
        }
        $xml .= '</feed>';

        return new TextResponse($xml, 200, ['Content-Type' => 'application/atom+xml; charset=utf-8', 'Cache-Control' => 'public, max-age=300']);
    }
}
