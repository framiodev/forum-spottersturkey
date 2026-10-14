<?php

namespace Framio\SeoPack\Redirect;

use Flarum\Discussion\Discussion;
use Framio\SeoPack\Support\SeoSettings;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Eski ve yanlış konu adreslerini kalıcı (301) yönlendirir; arama motorlarındaki eski bağlantılar doğru konuya gider.
 *
 * /d/{id}-{kısa-ad}[/{mesaj}] adresinde numara yoksa ya da kısa ad konunun kendi kısa adı değilse, o kısa ada sahip
 * TEK bir görünür konu varsa ona yönlendirilir (mesaj numarası korunur). Flarum kısa adı yok saydığı için bu adresler
 * 404 yerine yanlış konuyu açar; bu yüzden "Eski Adres Yönlendirmeleri & 404" modülü (yalnızca 404'lere bakar) onları
 * yakalayamaz. Aynı kısa ada sahip birden çok konu varsa (ör. Güncel / Arşiv) tahmin yapılmaz; numarası olmayanlar
 * 404 kaydına düşer ve o modülden yönlendirilir.
 */
class LegacyUrlRedirect implements MiddlewareInterface
{
    public function __construct(protected SeoSettings $seo)
    {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if (!in_array($request->getMethod(), ['GET', 'HEAD'], true) || !$this->seo->bool('enable_legacy_redirects')) {
            return $handler->handle($request);
        }

        $path = rawurldecode($request->getUri()->getPath());
        $query = $request->getUri()->getQuery();

        if (preg_match('~^/d/(\d+)-([^/]+?)(?:/(\d+))?/?$~u', $path, $m)) {
            $id = (int) $m[1];
            $slug = mb_strtolower($m[2]);
            $number = $m[3] ?? null;

            $current = Discussion::query()->where('id', $id)->where('is_private', false)->whereNull('hidden_at')->first(['id', 'slug']);
            if ($current && mb_strtolower((string) $current->slug) === $slug) {
                return $handler->handle($request); // doğru adres
            }

            $matches = Discussion::query()->where('slug', $slug)->where('is_private', false)->whereNull('hidden_at')->limit(2)->get(['id', 'slug']);
            if ($matches->count() === 1 && (!$current || $matches[0]->id !== $current->id)) {
                $d = $matches[0];

                return $this->redirect('/d/' . $d->id . '-' . $d->slug . ($number ? '/' . $number : ''), $query);
            }
        }

        return $handler->handle($request);
    }

    private function redirect(string $target, string $query): ResponseInterface
    {
        // Yalnızca site içi yollar (açık yönlendirme engeli)
        if (!str_starts_with($target, '/') || str_starts_with($target, '//')) {
            $target = '/' . ltrim((string) parse_url($target, PHP_URL_PATH), '/');
        }
        $url = rtrim($this->seo->baseUrl(), '/') . $target;
        if ($query !== '' && !str_contains($target, '?')) {
            $url .= '?' . $query;
        }

        return new RedirectResponse($url, 301, ['Cache-Control' => 'public, max-age=86400']);
    }
}
