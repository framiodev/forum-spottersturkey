<?php

namespace Framio\SeoPack\Middleware;

use Framio\SeoPack\Support\RedirectService;
use Framio\SeoPack\Support\SeoSettings;
use Laminas\Diactoros\Response\EmptyResponse;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Hata yakalayıcının dışında çalışır: forum 404 döndürdüğünde eski adresi
 * yönlendirmeye çözmeyi dener; çözemezse adresi 404 kaydına yazar.
 */
class LegacyRedirects implements MiddlewareInterface
{
    public function __construct(protected RedirectService $redirects, protected SeoSettings $seo)
    {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $response = $handler->handle($request);

        if ($response->getStatusCode() !== 404 || !in_array($request->getMethod(), ['GET', 'HEAD'], true)) {
            return $response;
        }

        $uri = $request->getUri();

        try {
            if ($this->seo->bool('enable_redirects') && ($hit = $this->redirects->resolve($uri->getPath(), $uri->getQuery()))) {
                [$status, $target] = $hit;

                if ($status === 410 || !$target) {
                    return new EmptyResponse(410, ['X-Robots-Tag' => 'noindex']);
                }

                return new RedirectResponse($target, in_array($status, [301, 302, 307, 308], true) ? $status : 301);
            }

            if ($this->seo->bool('enable_404_log')) {
                $this->redirects->logNotFound(
                    $uri->getPath(),
                    $uri->getQuery(),
                    $request->getHeaderLine('Referer'),
                    $request->getHeaderLine('User-Agent')
                );
            }
        } catch (\Throwable $e) {
            // Tablolar henüz yoksa (migration öncesi) sessizce 404'e devam
        }

        return $response;
    }
}
