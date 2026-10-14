<?php

namespace Flarum\Api\Controller;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Arr;
use InvalidArgumentException;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Tobscure\JsonApi\Document;
use Tobscure\JsonApi\Relationship;

/**
 * Compatibility base class replacing Flarum 1.x's
 * Flarum\Api\Controller\AbstractSerializeController, which extended the
 * removed tobscure/json-api package. Subclasses (via AbstractListController /
 * AbstractShowController / AbstractCreateController below) keep working
 * unchanged: they still implement data(ServerRequestInterface, Document) and
 * declare $serializer / $include / etc. exactly like on Flarum 1.x.
 *
 * Output is a hand-built JSON:API resource document (no tobscure, no
 * Tobyz\JsonApiServer) — sufficient for the app.request()-based custom
 * routes these controllers are registered on, which never went through
 * Flarum's core resource/store system in the first place.
 */
abstract class AbstractSerializeController implements RequestHandlerInterface
{
    public $serializer;
    public $include = [];
    public $optionalInclude = [];
    public $maxLimit = 50;
    public $limit = 20;
    public $sortFields = [];
    public $sort;

    /**
     * Deduped "type:id" => resource map accumulated across the response by
     * serializeItem(), flushed into the top-level "included" array in
     * handle(). Reset per-request in handle() so nothing leaks between
     * requests handled by the same (container-resolved) instance.
     *
     * @var array<string, array>
     */
    protected $includedResources = [];

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->includedResources = [];

        $document = new Document();

        $data = $this->data($request, $document);

        if (empty($this->serializer)) {
            throw new InvalidArgumentException('Serializer required for controller: '.static::class);
        }

        $serializer = resolve($this->serializer);
        $serializer->setRequest($request);

        $include = $this->extractInclude($request);

        $body = $this->serialize($data, $serializer, $include);

        if ($this->includedResources) {
            $body['included'] = array_values($this->includedResources);
        }

        $meta = $document->getMeta();
        if ($meta) {
            $body['meta'] = $meta;
        }

        $links = $document->getLinks();
        if ($links) {
            $body['links'] = $links;
        }

        return new JsonResponse($body);
    }

    /**
     * Get the data to be serialized and assigned to the response document.
     *
     * @return mixed
     */
    abstract protected function data(ServerRequestInterface $request, Document $document);

    /**
     * Turn $data (a single model, or an iterable of models) into a JSON:API
     * document body: ['data' => {...}] or ['data' => [...]].
     */
    abstract protected function serialize($data, $serializer, array $include): array;

    protected function serializeItem($model, $serializer, array $include): array
    {
        $item = [
            'type' => $serializer->getType(),
            'id' => $serializer->getId($model),
            'attributes' => $serializer->getAttributes($model),
        ];

        $relationships = [];

        foreach ($include as $name) {
            if (! method_exists($serializer, $name)) {
                continue;
            }

            // debug_backtrace-based relation-name inference (used by hasOne()/
            // hasMany() when called with no explicit $relation) sees this
            // reflective call itself, not the relation method's own name, so
            // tell the serializer what relation it's about to build instead.
            if (method_exists($serializer, 'setCurrentRelationName')) {
                $serializer->setCurrentRelationName($name);
            }

            $method = new \ReflectionMethod($serializer, $name);
            $method->setAccessible(true);
            $rel = $method->invoke($serializer, $model);

            if ($rel instanceof Relationship) {
                $relationships[$name] = $rel->toArray();

                foreach ($rel->getIncludedResources() as $resource) {
                    $key = $resource['type'].':'.$resource['id'];

                    // First one wins: a resource included via one post's
                    // relationship is identical to the same resource included
                    // via another post's (e.g. the same discussion appearing
                    // under multiple posts), so there's nothing to merge.
                    if (! isset($this->includedResources[$key])) {
                        $this->includedResources[$key] = $resource;
                    }
                }
            }
        }

        if ($relationships) {
            $item['relationships'] = $relationships;
        }

        return $item;
    }

    /**
     * Eager-load the relations named in $include (best-effort; unlike the
     * 1.x version this doesn't track extender-added relations, since none of
     * these extension-specific routes use that mechanism).
     */
    protected function loadRelations(Collection $models, array $relations, ?ServerRequestInterface $request = null): void
    {
        if (! empty($relations)) {
            $models->loadMissing(array_unique($relations));
        }
    }

    protected function extractInclude(ServerRequestInterface $request): array
    {
        $requested = Arr::get($request->getQueryParams(), 'include');

        if ($requested) {
            $available = array_merge($this->include, $this->optionalInclude);
            $requestedArr = array_filter(array_map('trim', explode(',', $requested)));
            $filtered = array_values(array_intersect($requestedArr, $available));

            if ($filtered) {
                return $filtered;
            }
        }

        return $this->include;
    }

    protected function extractFilter(ServerRequestInterface $request): array
    {
        return Arr::get($request->getQueryParams(), 'filter', []) ?: [];
    }

    protected function extractSort(ServerRequestInterface $request): ?array
    {
        $sort = Arr::get($request->getQueryParams(), 'sort');

        if (! $sort) {
            return $this->sort;
        }

        $fields = [];

        foreach (explode(',', $sort) as $field) {
            $field = trim($field);
            $direction = 'asc';

            if (str_starts_with($field, '-')) {
                $direction = 'desc';
                $field = substr($field, 1);
            }

            if (! $this->sortFields || in_array($field, $this->sortFields, true)) {
                $fields[$field] = $direction;
            }
        }

        return $fields ?: $this->sort;
    }

    protected function sortIsDefault(ServerRequestInterface $request): bool
    {
        return ! Arr::get($request->getQueryParams(), 'sort');
    }

    protected function extractOffset(ServerRequestInterface $request): int
    {
        return (int) Arr::get($request->getQueryParams(), 'page.offset', 0);
    }

    protected function extractLimit(ServerRequestInterface $request): int
    {
        $limit = Arr::get($request->getQueryParams(), 'page.limit');

        if ($limit === null) {
            return $this->limit;
        }

        return min((int) $limit, $this->maxLimit) ?: $this->limit;
    }
}
