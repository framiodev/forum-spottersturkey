<?php

namespace Framio\SeoPack;

use Flarum\Settings\SettingsRepositoryInterface;
use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class IndexNowKeyController implements RequestHandlerInterface
{
    protected SettingsRepositoryInterface $settings;

    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $requestedKey = $request->getAttribute('routeParameters')['key'] ?? '';
        $realKey = $this->settings->get('framio-seo.indexnow_key');

        if (!$realKey || !hash_equals($realKey, $requestedKey)) {
            return new TextResponse('Not found', 404);
        }

        return new TextResponse($realKey, 200, ['Content-Type' => 'text/plain; charset=utf-8']);
    }
}
