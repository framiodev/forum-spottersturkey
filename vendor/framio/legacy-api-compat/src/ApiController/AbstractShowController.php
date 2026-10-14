<?php

namespace Flarum\Api\Controller;

abstract class AbstractShowController extends AbstractSerializeController
{
    protected function serialize($data, $serializer, array $include): array
    {
        return ['data' => $this->serializeItem($data, $serializer, $include)];
    }
}
