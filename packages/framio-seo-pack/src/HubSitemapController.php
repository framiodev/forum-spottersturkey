<?php

namespace Framio\SeoPack;

use Framio\SeoPack\Support\EntityIndex;
use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/** /sitemap-hubs.xml: yeterli fotoğrafı olan marka / model / firma / plaka / şehir / yıl sayfaları. */
class HubSitemapController implements RequestHandlerInterface
{
    public function __construct(protected EntityIndex $index)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (!$this->index->enabled()) {
            return new TextResponse('Hub sitemap is disabled.', 404);
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
            . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

        $base = rtrim($this->index->url('brand', 'x'), 'x');
        $xml .= '<url><loc>' . htmlspecialchars(dirname(dirname($base . 'x')), ENT_XML1) . '</loc></url>' . "\n";

        foreach ($this->index->listing(null, null, 45000) as $row) {
            $xml .= '<url><loc>' . htmlspecialchars($this->index->url($row->type, $row->slug), ENT_XML1, 'UTF-8') . '</loc>';
            if ($row->latest) {
                $xml .= '<lastmod>' . date(DATE_ATOM, strtotime($row->latest)) . '</lastmod>';
            }
            $xml .= "</url>\n";
        }

        $xml .= '</urlset>';

        return new TextResponse($xml, 200, [
            'Content-Type' => 'application/xml; charset=utf-8',
            'Cache-Control' => 'public, max-age=1800',
            'X-Robots-Tag' => 'noindex',
        ]);
    }
}
