<?php

namespace Tobscure\JsonApi;

/**
 * Minimal stand-in for the removed tobscure/json-api Relationship class.
 * Holds a JSON:API-shaped relationship payload: ['data' => [...] | ['type'=>,'id'=>]].
 */
class Relationship
{
    protected array $data;

    /**
     * The full serialized resource(s) this relationship points to (one per
     * hasOne, one or more per hasMany), so the response can carry a real
     * JSON:API "included" array instead of dangling {type,id} pointers that
     * the frontend store can never resolve.
     *
     * @var array[] list of {type,id,attributes,...} resource objects
     */
    protected array $includedResources;

    public function __construct(array $data, array $includedResources = [])
    {
        $this->data = $data;
        $this->includedResources = $includedResources;
    }

    public function toArray(): array
    {
        return $this->data;
    }

    public function getIncludedResources(): array
    {
        return $this->includedResources;
    }
}
