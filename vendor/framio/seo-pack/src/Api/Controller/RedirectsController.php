<?php

namespace Framio\SeoPack\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\SeoPack\Support\RedirectService;
use Illuminate\Database\ConnectionInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * GET  /api/seo/redirects                    → yönlendirmeler + 404 kaydı
 * POST /api/seo/redirects {action: save, source, target, status}
 * POST /api/seo/redirects {action: delete, id}
 * POST /api/seo/redirects {action: dismiss, path}   (404 kaydını sil)
 * POST /api/seo/redirects {action: suggest, path}   (kalıplarla çözmeyi dene)
 * POST /api/seo/redirects {action: clear404}
 */
class RedirectsController implements RequestHandlerInterface
{
    public function __construct(protected RedirectService $redirects, protected ConnectionInterface $db)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        if ($request->getMethod() === 'GET') {
            return $this->listing();
        }

        $body = (array) $request->getParsedBody();

        switch ($body['action'] ?? '') {
            case 'save':
                $source = trim((string) ($body['source'] ?? ''));
                $target = trim((string) ($body['target'] ?? ''));
                $status = (int) ($body['status'] ?? 301);
                if ($source === '' || ($target === '' && $status !== 410)) {
                    return new JsonResponse(['error' => 'Kaynak ve hedef gerekli (410 hariç).'], 422);
                }
                if (preg_match('#^https?://#i', $source)) {
                    $source = (parse_url($source, PHP_URL_PATH) ?: '/') . (($q = parse_url($source, PHP_URL_QUERY)) ? '?' . $q : '');
                }
                $this->redirects->remember($source, $target ?: null, in_array($status, [301, 302, 410], true) ? $status : 301, 'manual');
                break;

            case 'delete':
                $this->db->table(RedirectService::REDIRECTS)->where('id', (int) ($body['id'] ?? 0))->delete();
                break;

            case 'dismiss':
                $this->db->table(RedirectService::NOT_FOUND)->where('path', (string) ($body['path'] ?? ''))->delete();
                break;

            case 'clear404':
                $this->db->table(RedirectService::NOT_FOUND)->truncate();
                break;

            case 'suggest':
                $path = (string) ($body['path'] ?? '');
                $hit = $this->redirects->resolve(parse_url($path, PHP_URL_PATH) ?: '/', (string) parse_url($path, PHP_URL_QUERY));

                return new JsonResponse(['resolved' => (bool) $hit, 'status' => $hit[0] ?? null, 'target' => $hit[1] ?? null]);

            default:
                return new JsonResponse(['error' => 'Geçersiz işlem.'], 400);
        }

        return $this->listing();
    }

    private function listing(): ResponseInterface
    {
        return new JsonResponse([
            'redirects' => $this->db->table(RedirectService::REDIRECTS)->orderBy('hits', 'desc')->orderBy('id', 'desc')->limit(500)->get(),
            'not_found' => $this->db->table(RedirectService::NOT_FOUND)->orderBy('bot_hits', 'desc')->orderBy('hits', 'desc')->limit(300)->get(),
            'stats' => [
                'redirects' => $this->db->table(RedirectService::REDIRECTS)->count(),
                'redirect_hits' => (int) $this->db->table(RedirectService::REDIRECTS)->sum('hits'),
                'not_found' => $this->db->table(RedirectService::NOT_FOUND)->count(),
            ],
        ]);
    }
}
