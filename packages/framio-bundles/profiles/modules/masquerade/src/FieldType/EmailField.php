<?php

namespace Framio\Profiles\Masquerade\FieldType;

class EmailField extends BaseField
{
    public function overrideAttributes(): array
    {
        return [
            'validation' => 'email',
        ];
    }
}
