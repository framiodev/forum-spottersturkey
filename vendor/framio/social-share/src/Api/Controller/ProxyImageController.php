<?php

namespace Framio\SocialShare\Api\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response;
use Laminas\Diactoros\Response\JsonResponse;
use GuzzleHttp\Client;
use Throwable;

class ProxyImageController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $params = $request->getQueryParams();
        $url = trim($params['url'] ?? '');

        if (empty($url)) {
            return new JsonResponse(['error' => 'URL parametresi gerekli'], 400);
        }

        // Güvenlik ve geçerlilik kontrolü
        if (!preg_match('/^https?:\/\//i', $url)) {
            $baseUrl = rtrim((string)resolve('flarum.config')['url'], '/');
            $url = $baseUrl . '/' . ltrim($url, '/');
        }

        try {
            $client = new Client([
                'timeout' => 15,
                'verify' => false,
                'headers' => [
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UlasimArsiv/1.0',
                    'Accept' => 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                ]
            ]);

            $res = $client->get($url);
            $body = (string)$res->getBody();
            $contentType = $res->getHeaderLine('Content-Type') ?: 'image/jpeg';

            $response = new Response();
            $response->getBody()->write($body);

            return $response
                ->withHeader('Content-Type', $contentType)
                ->withHeader('Access-Control-Allow-Origin', '*')
                ->withHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
                ->withHeader('Access-Control-Allow-Headers', '*')
                ->withHeader('Cache-Control', 'public, max-age=86400');
        } catch (Throwable $e) {
            return new JsonResponse([
                'error' => 'Görsel çekilemedi',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
