<?php

namespace Framio\General\Debug;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 1. Hata raporlayıcıya istek bilgisini (adres, kullanıcı, rota) taşır;
 *    Reporter arayüzü isteği almadığı için geçerli istek burada tutulur.
 * 2. Eklentilerin kendi try/catch'iyle yakalayıp hata yanıtı olarak
 *    döndürdüğü istekleri de günlüğe yazar (Flarum raporlayıcısı bunları
 *    hiç görmez): 5xx → Hata, anlamlı 4xx (400/409/422) → Uyarı.
 */
class RequestContext implements MiddlewareInterface
{
    public static ?ServerRequestInterface $request = null;

    /** Bu istek sırasında raporlayıcı zaten bir istisna kaydetti mi */
    public static bool $reported = false;

    public function __construct(protected DebugLog $log)
    {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        self::$request = $request;
        self::$reported = false;

        $response = $handler->handle($request);

        $status = $response->getStatusCode();
        if (!self::$reported && ($status >= 500 || in_array($status, [400, 409, 422], true))) {
            // Hata günlüğünün kendi uç noktası kendini kaydetmesin
            if (!str_contains($request->getUri()->getPath(), 'debug-logs')) {
                $this->log->recordResponse($request, $response);
            }
        }

        return $response;
    }
}
