<?php

namespace Framio\Profiles\Masquerade\FieldType;

class BooleanField extends BaseField
{
    public function overrideAttributes(): array
    {
        return [
            'validation' => 'boolean',
        ];
    }
}
