<?php

namespace Framio\Profiles\Masquerade\FieldType;

class UrlField extends BaseField
{
    public function overrideAttributes(): array
    {
        return [
            'validation' => 'url',
        ];
    }
}
