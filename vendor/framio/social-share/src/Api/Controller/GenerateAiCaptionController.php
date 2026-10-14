<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\SocialShare\Services\AiCaptionService;

class GenerateAiCaptionController implements RequestHandlerInterface
{
    protected AiCaptionService $aiService;

    public function __construct(AiCaptionService $aiService)
    {
        $this->aiService = $aiService;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $body = $request->getParsedBody();
        $meta = $body['meta'] ?? [];
        $length = $body['length'] ?? 'medium';

        $params = [
            'sirket' => $meta['sirket'] ?? ($body['sirket'] ?? ''),
            'plaka' => $meta['plaka'] ?? ($body['plaka'] ?? ''),
            'model' => $meta['model'] ?? ($body['model'] ?? ''),
            'sehir' => $meta['sehir'] ?? ($body['sehir'] ?? ''),
            'yazar' => $meta['yazar'] ?? ($body['yazar'] ?? ''),
            'yil' => $meta['yil'] ?? ($body['yil'] ?? date('Y')),
            'length' => $length,
            'trivia' => $meta['trivia'] ?? ($body['trivia'] ?? ''),
            'custom_prompt' => $body['custom_prompt'] ?? '',
            'images' => $meta['images'] ?? ($body['images'] ?? [])
        ];

        $result = $this->aiService->generate($params);

        return new JsonResponse($result);
    }
}
