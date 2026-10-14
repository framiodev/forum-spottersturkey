<?php

namespace Framio\CustomHomepage\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\RedirectResponse;
use Dflydev\FigCookies\FigRequestCookies;
use Dflydev\FigCookies\FigResponseCookies;
use Dflydev\FigCookies\SetCookie;

class LightboxRedirectMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $cookie = FigRequestCookies::get($request, 'framio_lightbox_open');
        
        if ($cookie->getValue() === '1') {
            $originalUrl = '/';
            $originalUrlCookie = FigRequestCookies::get($request, 'framio_original_url');
            if ($originalUrlCookie->getValue()) {
                $originalUrl = urldecode($originalUrlCookie->getValue());
            }

            $response = new RedirectResponse($originalUrl);
            $response = FigResponseCookies::set($response, SetCookie::create('framio_lightbox_open')->withValue('')->withExpires(new \DateTime('-1 year'))->withPath('/'));
            $response = FigResponseCookies::set($response, SetCookie::create('framio_original_url')->withValue('')->withExpires(new \DateTime('-1 year'))->withPath('/'));
            return $response;
        }

        return $handler->handle($request);
    }
}
