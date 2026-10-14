<?php

namespace Framio\SeoPack;

use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\HtmlResponse;
use Flarum\Http\UrlGenerator;
use Illuminate\Support\Arr;
use Google\Client;

class GoogleCallbackController implements RequestHandlerInterface
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

        $params = $request->getQueryParams();
        $code = Arr::get($params, 'code');

        if (!$code) {
            return new HtmlResponse('<h1>Hata</h1><p>Google tarafından doğrulama kodu döndürülmedi.</p>');
        }

        $clientId = $this->settings->get('framio-seo.google_client_id');
        $clientSecret = $this->settings->get('framio-seo.google_client_secret');

        $client = new Client();
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->setRedirectUri($this->url->to('api')->base() . '/seo/google-callback');

        try {
            $token = $client->fetchAccessTokenWithAuthCode($code);

            if (isset($token['error'])) {
                return new HtmlResponse('<h1>Hata</h1><p>Token alınırken hata oluştu: ' . htmlspecialchars($token['error_description'] ?? $token['error']) . '</p>');
            }

            $encoded = json_encode($token);
            if ($encoded === false) {
                return new HtmlResponse('<h1>Hata</h1><p>JSON Encode Hatası: ' . json_last_error_msg() . '</p>');
            }
            $this->settings->set('framio-seo.google_tokens', $encoded);

            $html = <<<HTML
<!DOCTYPE html>
<html>
<head><title>Başarılı</title></head>
<body>
    <script>
        if (window.opener) {
            window.opener.postMessage('google_auth_success', '*');
            window.close();
        } else {
            window.location.href = "{$this->url->to('forum')->base()}/admin#/extension/framio-seo-pack";
        }
    </script>
    <p>Bağlantı başarılı. Bu pencereyi kapatabilirsiniz.</p>
</body>
</html>
HTML;
            return new HtmlResponse($html);

        } catch (\Exception $e) {
            return new HtmlResponse('<h1>Hata</h1><p>İstisna oluştu: ' . htmlspecialchars($e->getMessage()) . '</p>');
        }
    }
}
