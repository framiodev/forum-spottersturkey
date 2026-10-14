<?php

namespace Framio\Profiles\Masquerade\Events;

use Flarum\User\User;
use Framio\Profiles\Masquerade\Field;

abstract class AbstractFieldEvent
{
    public function __construct(
        public Field $field,
        public User $actor,
        public array $data = []
    ) {
    }
}
