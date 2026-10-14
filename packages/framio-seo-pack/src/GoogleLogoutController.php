<?php

namespace Framio\SeoPack;

use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Google\Client;

class GoogleLogoutController implements RequestHandlerInterface
{
    protected $settings;

    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = \Flarum\Http\RequestUtil::getActor($request);
        $actor->assertAdmin();

        $tokens = $this->settings->get('framio-seo.google_tokens');
        if ($tokens) {
            $tokensArr = json_decode($tokens, true);
            $client = new Client();
            
            if (!empty($tokensArr['access_token'])) {
                try {
                    $client->setAccessToken($tokensArr);
                    $client->revokeToken();
                } catch (\Exception $e) {}
            }

            $this->settings->delete('framio-seo.google_tokens');
        }

        return new JsonResponse(['status' => 'success', 'message' => 'Google hesabı başarıyla ayrıldı.']);
    }
}
