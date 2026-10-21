<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\UploadExif\Ai\CanonRules;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Admin: yazım standardını eski gönderilere uygulama
 *   GET  /framio-media/canon          → önizleme (hangi gönderide hangi satır nasıl değişecek)
 *   POST /framio-media/canon          → uygula (en çok 500 gönderi; tekrar basılarak devam edilir)
 *   POST /framio-media/canon?undo=1   → son uygulamayı geri al
 */
class CanonRulesController implements RequestHandlerInterface
{
    public function __construct(protected CanonRules $canon)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();
        @set_time_limit(600);

        if ($request->getMethod() === 'GET') {
            $plan = $this->canon->plan();

            return new JsonResponse(['count' => count($plan), 'items' => array_map(fn ($r) => array_diff_key($r, ['content' => 1]), array_slice($plan, 0, 100))]);
        }
        if (!empty($request->getQueryParams()['undo'])) {
            return new JsonResponse(['undone' => $this->canon->undo()]);
        }

        return new JsonResponse(['applied' => $this->canon->apply($this->canon->plan(), date('YmdHis') . '_' . substr(uniqid(), -5))]);
    }
}
