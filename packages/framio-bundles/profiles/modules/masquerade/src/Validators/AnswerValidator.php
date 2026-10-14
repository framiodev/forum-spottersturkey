<?php

namespace Framio\Profiles\Masquerade\Validators;

use Framio\Profiles\Masquerade\Field;
use Flarum\Foundation\AbstractValidator;

class AnswerValidator extends AbstractValidator
{
    /**
     * @param Field $field
     * @return self
     */
    public function setField(Field $field): self
    {
        $rules = [];

        if ($field->required) {
            $rules[] = 'required';
        }

        if ($field->validation) {
            $rules = array_merge($rules, explode('|', $field->validation));
        }

        $this->rules = [$field->name => $rules];

        return $this;
    }
}
