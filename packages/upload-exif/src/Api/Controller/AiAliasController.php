<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\UploadExif\Ai\ModelAliases;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/** POST /framio-media/ai-alias — künye onaylanırken AI'nın marka/modeli düzeltildiyse öğrenilir (şehir içi, kamyon) */
class AiAliasController implements RequestHandlerInterface
{
    public function __construct(protected ModelAliases $aliases)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();
        $b = (array) $request->getParsedBody();
        $kind = $this->aliases->kind($this->aliases->slugs(((int) Arr::get($b, 'discussion_id')) ?: null, Arr::get($b, 'tag_slug') ?: null));
        if ($kind) {
            $this->aliases->learn($kind, (string) Arr::get($b, 'ai_brand', ''), (string) Arr::get($b, 'ai_model', ''),
                trim((string) Arr::get($b, 'brand', '')), trim((string) Arr::get($b, 'model', '')), $actor);
        }

        return new JsonResponse(['ok' => true, 'kind' => $kind]);
    }
}
