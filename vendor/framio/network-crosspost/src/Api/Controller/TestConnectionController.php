<?php

namespace Framio\NetworkCrosspost\Api\Controller;

use Flarum\Http\RequestUtil;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class TestConnectionController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        if (!$actor->isAdmin()) {
            return new JsonResponse(['error' => 'Bu işlem yalnızca yöneticiler tarafından çalıştırılabilir.'], 403);
        }

        $body = (array) $request->getParsedBody();
        $targetUrl = rtrim((string) Arr::get($body, 'url', ''), '/');
        $secretKey = trim((string) Arr::get($body, 'secret_key', ''));

        if (empty($targetUrl) || empty($secretKey)) {
            return new JsonResponse(['error' => 'Hedef URL ve Güvenlik Anahtarı gereklidir.'], 422);
        }

        $client = new Client([
            'timeout' => 8.0,
            'http_errors' => false,
            'verify' => false
        ]);

        try {
            $response = $client->post($targetUrl . '/api/framio/crosspost/inbound', [
                'headers' => [
                    'X-Crosspost-Secret' => $secretKey,
                    'Accept' => 'application/json',
                ],
                'json' => [
                    'action' => 'ping'
                ]
            ]);

            $statusCode = $response->getStatusCode();
            $data = json_decode((string) $response->getBody(), true);

            if ($statusCode === 200 && Arr::get($data, 'success')) {
                return new JsonResponse([
                    'success' => true,
                    'message' => 'Bağlantı doğrulandı! Hedef platform: ' . Arr::get($data, 'platform', 'Flarum Platform')
                ]);
            }

            return new JsonResponse([
                'success' => false,
                'error' => Arr::get($data, 'error', 'Hedef sunucu ' . $statusCode . ' durum kodunu döndürdü.')
            ]);
        } catch (GuzzleException $e) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Bağlantı sağlanamadı: ' . $e->getMessage()
            ]);
        }
    }
}
