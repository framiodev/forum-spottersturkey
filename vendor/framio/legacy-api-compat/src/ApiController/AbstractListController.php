<?php

namespace Flarum\Api\Controller;

abstract class AbstractListController extends AbstractSerializeController
{
    protected function serialize($data, $serializer, array $include): array
    {
        $items = [];

        foreach ($data as $model) {
            $items[] = $this->serializeItem($model, $serializer, $include);
        }

        return ['data' => $items];
    }
}
