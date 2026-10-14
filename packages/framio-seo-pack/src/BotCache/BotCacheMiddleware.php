<?php

namespace Framio\SeoPack\BotCache;

use Laminas\Diactoros\Response\HtmlResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Oturum başlamadan önce çalışır: giriş yapmamış arama motoru botlarının GET isteklerine önbellekten hazır HTML verir.
 * Önbellekte yoksa istek normal işlenir; 200 dönen HTML yanıt sonraki botlar için saklanır.
 * İnsan ziyaretçiler, oturum çerezi taşıyan istekler, yönetim/API ve form sayfaları kapsam dışıdır.
 */
class BotCacheMiddleware implements MiddlewareInterface
{
    private const EXCLUDE = '~^/(api|admin|settings|notifications|logout|login|register|reset|confirm|framio-cron|framio-media|assets)(/|$)~i';

    public function __construct(protected BotPageCache $cache)
    {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if (!$this->eligible($request)) {
            return $handler->handle($request);
        }

        $key = $this->key($request);
        if ($hit = $this->cache->get($key)) {
            return new HtmlResponse($hit['body'], 200, [
                'Content-Type' => $hit['type'],
                'X-Framio-Bot-Cache' => 'HIT',
                // Sunucu/ara önbellekler (LiteSpeed vb.) bu yanıtı saklayıp insanlara sunmamalı
                'Cache-Control' => 'private, no-store',
                'X-LiteSpeed-Cache-Control' => 'no-cache',
                'Vary' => 'User-Agent',
            ]);
        }

        $response = $handler->handle($request);

        $type = $response->getHeaderLine('Content-Type');
        if ($response->getStatusCode() === 200 && str_starts_with(strtolower($type), 'text/html')) {
            $body = (string) $response->getBody();
            if ($body !== '' && strlen($body) < 3 * 1024 * 1024) {
                $this->cache->put($key, $body, $type);
            }
        }

        return $response->withHeader('X-Framio-Bot-Cache', 'MISS')->withHeader('X-LiteSpeed-Cache-Control', 'no-cache');
    }

    private function eligible(ServerRequestInterface $request): bool
    {
        if (!$this->cache->enabled() || !in_array($request->getMethod(), ['GET', 'HEAD'], true)) return false;
        if (!$this->cache->isBot($request->getHeaderLine('User-Agent'))) return false;
        if (preg_match(self::EXCLUDE, $request->getUri()->getPath())) return false;

        // Oturum/giriş çerezi taşıyan istekler (ör. bot taklidi yapan oturumlu kullanıcı) asla önbellekten beslenmez
        foreach (array_keys($request->getCookieParams()) as $name) {
            if (str_contains($name, 'flarum_remember') || str_contains($name, 'flarum_session')) return false;
        }

        return true;
    }

    private function key(ServerRequestInterface $request): string
    {
        $uri = $request->getUri();

        return strtolower($uri->getHost()) . $uri->getPath() . ($uri->getQuery() !== '' ? '?' . $uri->getQuery() : '');
    }
}
