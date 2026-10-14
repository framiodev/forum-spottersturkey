<?php

namespace Tobscure\JsonApi;

/**
 * Minimal stand-in for the removed tobscure/json-api Document class, covering
 * only the subset of the API (setMeta/addMeta/addPaginationLinks) that
 * extensions written for Flarum 1.x actually call.
 */
class Document
{
    protected array $meta = [];
    protected array $links = [];

    public function setMeta(array $meta): void
    {
        $this->meta = $meta;
    }

    public function addMeta($key, $value = null): void
    {
        if (is_array($key)) {
            $this->meta = array_merge($this->meta, $key);
        } else {
            $this->meta[$key] = $value;
        }
    }

    public function addPaginationLinks(string $url, array $queryParams, int $offset, int $limit, ?int $count = null): void
    {
        unset($queryParams['page']);

        $buildUrl = function (int $newOffset) use ($url, $queryParams) {
            $params = $queryParams;
            if ($newOffset > 0) {
                $params['page']['offset'] = $newOffset;
                $params['page']['limit'] = $limit;
            }

            return $params ? $url.'?'.http_build_query($params) : $url;
        };

        $this->links['first'] = $buildUrl(0);

        if ($offset > 0) {
            $this->links['prev'] = $buildUrl(max(0, $offset - $limit));
        }

        if ($count === null || $offset + $limit < $count) {
            $this->links['next'] = $buildUrl($offset + $limit);
        }
    }

    public function getMeta(): array
    {
        return $this->meta;
    }

    public function getLinks(): array
    {
        return $this->links;
    }
}
