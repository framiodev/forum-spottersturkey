<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use GuzzleHttp\Client;

/** Admin: Meta erişim jetonunun geçerliliği ve kalan süresi */
class CheckTokenHealthController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if (!$actor || !$actor->isAdmin()) {
            return new JsonResponse(['error' => 'Yetkisiz erişim.'], 403);
        }

        $body = (array) $request->getParsedBody();
        $token = $body['token'] ?? '';

        if (empty($token)) {
            return new JsonResponse(['valid' => false, 'error' => 'Token bulunamadı.'], 400);
        }

        try {
            $client = new Client(['timeout' => 10]);

            $response = $client->get('https://graph.facebook.com/v19.0/debug_token', [
                'query' => [
                    'input_token' => $token,
                    'access_token' => $token,
                ],
            ]);

            $json = json_decode($response->getBody()->getContents(), true);
            $data = $json['data'] ?? [];

            $isValid = $data['is_valid'] ?? false;
            $expiresAt = $data['expires_at'] ?? 0;
            $type = $data['type'] ?? 'PAGE';
            $scopes = $data['scopes'] ?? [];

            $neverExpires = ($expiresAt === 0);
            $daysLeft = null;
            $expiryDate = null;

            if (!$neverExpires && $expiresAt > 0) {
                $secondsLeft = $expiresAt - time();
                $daysLeft = max(0, round($secondsLeft / 86400));
                $expiryDate = date('d.m.Y H:i', $expiresAt);
            }

            return new JsonResponse([
                'valid' => $isValid,
                'type' => $type,
                'is_never_expire' => $neverExpires,
                'expires_at' => $expiresAt,
                'days_left' => $daysLeft,
                'expiry_date' => $expiryDate,
                'scopes' => $scopes,
            ]);
        } catch (\Exception $e) {
            try {
                $client = new Client(['timeout' => 10]);
                $response = $client->get('https://graph.facebook.com/v19.0/me', [
                    'query' => [
                        'access_token' => $token,
                        'fields' => 'id,name',
                    ],
                ]);
                $me = json_decode($response->getBody()->getContents(), true);

                if (!empty($me['id'])) {
                    return new JsonResponse([
                        'valid' => true,
                        'type' => 'PAGE',
                        'is_never_expire' => true,
                        'account_name' => $me['name'] ?? '',
                        'days_left' => null,
                        'note' => 'Token aktif ve çalışıyor.',
                    ]);
                }
            } catch (\Exception $e2) {
                return new JsonResponse([
                    'valid' => false,
                    'error' => 'Geçersiz veya süresi dolmuş token: ' . $e2->getMessage(),
                ]);
            }

            return new JsonResponse([
                'valid' => false,
                'error' => 'Token doğrulanamadı: ' . $e->getMessage(),
            ]);
        }
    }
}
