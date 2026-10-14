<?php

namespace Framio\SeoPack;

use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Flarum\Http\UrlGenerator;
use Google\Client;

class GoogleAuthController implements RequestHandlerInterface
{
    protected $settings;
    protected $url;

    public function __construct(SettingsRepositoryInterface $settings, UrlGenerator $url)
    {
        $this->settings = $settings;
        $this->url = $url;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = \Flarum\Http\RequestUtil::getActor($request);
        $actor->assertAdmin();

        $clientId = $this->settings->get('framio-seo.google_client_id');
        $clientSecret = $this->settings->get('framio-seo.google_client_secret');

        if (!$clientId || !$clientSecret) {
            return new JsonResponse(['status' => 'error', 'message' => 'Client ID veya Client Secret eksik.'], 400);
        }

        $client = new Client();
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->setRedirectUri($this->url->to('api')->base() . '/seo/google-callback');
        $client->addScope('https://www.googleapis.com/auth/analytics.readonly');
        $client->addScope('https://www.googleapis.com/auth/webmasters.readonly');
        $client->addScope('https://www.googleapis.com/auth/indexing');
        $client->setAccessType('offline');
        $client->setPrompt('consent');

        return new JsonResponse([
            'status' => 'success',
            'auth_url' => $client->createAuthUrl()
        ]);
    }
}
