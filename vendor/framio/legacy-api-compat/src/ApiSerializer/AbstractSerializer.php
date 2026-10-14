<?php

namespace Flarum\Api\Serializer;

use DateTime;
use Flarum\Http\RequestUtil;
use Psr\Http\Message\ServerRequestInterface as Request;
use Tobscure\JsonApi\Relationship;

/**
 * Compatibility base class replacing Flarum 1.x's
 * Flarum\Api\Serializer\AbstractSerializer (which extended the now-removed
 * tobscure/json-api package). Extensions built against the 1.x serializer
 * API keep working unchanged against this class: getDefaultAttributes(),
 * formatDate(), hasOne()/hasMany() all behave the same way.
 *
 * The output produced here is a plain, hand-built JSON:API resource object
 * (type/id/attributes/relationships) rather than going through Flarum 2.0's
 * new Tobyz\JsonApiServer resource/schema system, since these are all
 * extension-specific routes (registered via Extend\Routes) rather than
 * entries in Flarum's core resource registry.
 */
abstract class AbstractSerializer
{
    protected $type;

    /** @var Request */
    protected $request;

    protected $actor;

    /**
     * The relation name serializeItem() is about to invoke, set right before
     * it reflectively calls the relation method. hasOne()/hasMany() prefer
     * this over debug_backtrace() inference, which sees the reflective call
     * site rather than the relation method's own name.
     */
    protected ?string $currentRelationName = null;

    public function setCurrentRelationName(?string $name): void
    {
        $this->currentRelationName = $name;
    }

    public function setRequest(Request $request): void
    {
        $this->request = $request;
        $this->actor = RequestUtil::getActor($request);
    }

    public function getRequest()
    {
        return $this->request;
    }

    public function getActor()
    {
        return $this->actor;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getId($model): string
    {
        if (is_object($model)) {
            return (string) $model->id;
        }

        if (is_array($model)) {
            return (string) $model['id'];
        }

        return (string) $model;
    }

    public function getAttributes($model): array
    {
        if (! is_object($model) && ! is_array($model)) {
            return [];
        }

        return $this->getDefaultAttributes($model);
    }

    abstract protected function getDefaultAttributes($model);

    /**
     * Flarum 1 eklentileri tarih sütununu çoğu zaman cast'siz, metin olarak
     * verir ('2026-07-01 17:50:00'); metni de kabul et.
     */
    public function formatDate($date = null): ?string
    {
        if ($date === null || $date === '') {
            return null;
        }
        if (!$date instanceof \DateTimeInterface) {
            try {
                $date = new \DateTimeImmutable((string) $date);
            } catch (\Throwable $e) {
                return null;
            }
        }

        return $date->format(DateTime::RFC3339);
    }

    public function hasOne($model, $serializer, $relation = null): ?Relationship
    {
        return $this->buildRelationship($model, $serializer, $relation, false);
    }

    public function hasMany($model, $serializer, $relation = null): ?Relationship
    {
        return $this->buildRelationship($model, $serializer, $relation, true);
    }

    protected function buildRelationship($model, $serializer, $relation, bool $many): ?Relationship
    {
        if ($relation === null) {
            $relation = $this->currentRelationName;
        }

        if ($relation === null) {
            $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 3);
            $relation = $trace[1]['function'] ?? null;
        }

        $data = $this->getRelationshipData($model, $relation);

        if ($data === null) {
            return null;
        }

        $resolved = $this->resolveSerializer($serializer);

        if ($many) {
            $items = [];
            $included = [];
            foreach ($data as $item) {
                $items[] = [
                    'type' => $resolved->getType(),
                    'id' => $resolved->getId($item),
                ];
                $included[] = [
                    'type' => $resolved->getType(),
                    'id' => $resolved->getId($item),
                    'attributes' => $resolved->getAttributes($item),
                ];
            }

            return new Relationship(['data' => $items], $included);
        }

        return new Relationship([
            'data' => [
                'type' => $resolved->getType(),
                'id' => $resolved->getId($data),
            ],
        ], [
            [
                'type' => $resolved->getType(),
                'id' => $resolved->getId($data),
                'attributes' => $resolved->getAttributes($data),
            ],
        ]);
    }

    protected function getRelationshipData($model, $relation)
    {
        if (is_object($model)) {
            $value = $model->$relation ?? null;
        } elseif (is_array($model)) {
            $value = $model[$relation] ?? null;
        } else {
            return null;
        }

        if ($value === null) {
            return null;
        }

        // Eloquent collections/relations iterate fine as-is; a single model
        // is returned as-is for hasOne.
        return $value;
    }

    /**
     * @param string|AbstractSerializer $serializer
     */
    protected function resolveSerializer($serializer): self
    {
        if ($serializer instanceof self) {
            $serializer->setRequest($this->request);

            return $serializer;
        }

        $instance = resolve($serializer);
        $instance->setRequest($this->request);

        return $instance;
    }
}
