<?php

namespace Framio\SeoPack;

use Framio\SeoPack\Support\SeoSettings;
use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * /ads.txt — Google AdSense yayıncı doğrulaması. Satır, admin'deki yayıncı kimliğinden (ca-pub-…) üretilir;
 * diğer reklam ağları için ek satırlar admin'den eklenir. Sunucuda fiziksel ads.txt varsa o önceliklidir.
 */
class AdsTxtController implements RequestHandlerInterface
{
    public function __construct(protected SeoSettings $seo)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $lines = [];
        $client = trim($this->seo->get('ads_client'));
        if (preg_match('/(pub-\d{6,})/', $client, $m)) {
            // f08c47fec0942fa0: Google'ın sabit TAG kimliği
            $lines[] = 'google.com, ' . $m[1] . ', DIRECT, f08c47fec0942fa0';
        }
        foreach (preg_split('/\r?\n/', $this->seo->get('ads_txt_extra')) as $line) {
            if (($line = trim($line)) !== '') $lines[] = $line;
        }

        if (!$lines) {
            return new TextResponse('', 404);
        }

        return new TextResponse(implode("\n", array_unique($lines)) . "\n", 200, ['Cache-Control' => 'public, max-age=3600']);
    }
}
