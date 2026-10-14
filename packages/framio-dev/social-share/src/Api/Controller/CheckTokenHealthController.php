<?php

namespace Framio\SocialShare\Api\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use GuzzleHttp\Client;

class CheckTokenHealthController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface ): ResponseInterface
    {
         = ->getAttribute('actor');
        if (! || !->isAdmin()) {
            return new JsonResponse(['error' => 'Yetkisiz erişim.'], 403);
        }

         = ->getParsedBody();
         = ['token'] ?? '';

        if (empty()) {
            return new JsonResponse(['valid' => false, 'error' => 'Token bulunamadı.'], 400);
        }

        try {
             = new Client(['timeout' => 10]);

             = ->get('https://graph.facebook.com/v19.0/debug_token', [
                'query' => [
                    'input_token' => ,
                    'access_token' => ,
                ]
            ]);

             = json_decode(->getBody()->getContents(), true);
             = ['data'] ?? [];

             = ['is_valid'] ?? false;
             = ['expires_at'] ?? 0;
             = ['type'] ?? 'PAGE';
             = ['scopes'] ?? [];

             = ( === 0);
             = null;
             = null;

            if (! &&  > 0) {
                 =  - time();
                 = max(0, round( / 86400));
                 = date('d.m.Y H:i', );
            }

            return new JsonResponse([
                'valid' => ,
                'type' => ,
                'is_never_expire' => ,
                'expires_at' => ,
                'days_left' => ,
                'expiry_date' => ,
                'scopes' => ,
            ]);
        } catch (\Exception ) {
            try {
                 = new Client(['timeout' => 10]);
                 = ->get('https://graph.facebook.com/v19.0/me', [
                    'query' => [
                        'access_token' => ,
                        'fields' => 'id,name'
                    ]
                ]);
                 = json_decode(->getBody()->getContents(), true);

                if (!empty(['id'])) {
                    return new JsonResponse([
                        'valid' => true,
                        'type' => 'PAGE',
                        'is_never_expire' => true,
                        'account_name' => ['name'] ?? '',
                        'days_left' => null,
                        'note' => 'Token aktif ve çalışıyor.'
                    ]);
                }
            } catch (\Exception ) {
                return new JsonResponse([
                    'valid' => false,
                    'error' => 'Geçersiz veya süresi dolmuş token: ' . ->getMessage()
                ]);
            }

            return new JsonResponse([
                'valid' => false,
                'error' => 'Token doğrulanamadı: ' . ->getMessage()
            ]);
        }
    }
}
