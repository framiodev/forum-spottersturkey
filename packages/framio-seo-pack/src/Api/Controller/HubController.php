<?php

namespace Framio\SeoPack\Api\Controller;

use Framio\SeoPack\Support\EntityIndex;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * GET /api/seo/hubs                         → türlere göre derleme listesi
 * GET /api/seo/hubs?type=model&slug=…&page=2 → tek derleme (SPA sayfası için)
 * Herkese açık; görünürlük EntityIndex içinde misafir yetkisiyle denetlenir.
 */
class HubController implements RequestHandlerInterface
{
    public function __construct(protected EntityIndex $index)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (!$this->index->enabled()) {
            return new JsonResponse(['errors' => [['status' => '404']]], 404);
        }

        $params = $request->getQueryParams();
        $type = EntityIndex::typeFromPath((string) Arr::get($params, 'type')) ?? (array_key_exists((string) Arr::get($params, 'type'), EntityIndex::TYPES) ? Arr::get($params, 'type') : null);
        $slug = (string) Arr::get($params, 'slug', '');

        if ($type && $slug !== '') {
            $data = $this->index->entity($type, $slug, max(1, (int) Arr::get($params, 'page', 1)));

            return $data ? new JsonResponse(['data' => $data]) : new JsonResponse(['errors' => [['status' => '404']]], 404);
        }

        return new JsonResponse(['data' => $this->groups($type)]);
    }

    /** Dizin sayfası verisi: her tür için derlemeler */
    public function groups(?string $only = null): array
    {
        $groups = [];
        foreach (EntityIndex::TYPES as $type => $def) {
            if ($only && $only !== $type) {
                continue;
            }
            $groups[] = [
                'type' => $type,
                'path' => $def['path'],
                'label' => $def['label'],
                'items' => array_map(fn ($r) => [
                    'slug' => $r->slug,
                    'name' => $r->name,
                    'posts' => (int) $r->posts,
                    'url' => $this->index->url($type, $r->slug),
                ], $this->index->listing($type, null, $only ? 2000 : 60)),
            ];
        }

        return $groups;
    }
}
