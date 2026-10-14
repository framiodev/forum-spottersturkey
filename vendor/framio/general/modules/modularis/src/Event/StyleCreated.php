<?php

namespace Stezkoy\FlarumModularis\Event;

use Flarum\User\User;
use Stezkoy\FlarumModularis\Style;

class StyleCreated
{
    public function __construct(
        public readonly Style $style,
        public readonly ?User $actor = null,
        public readonly array $data = [],
    ) {}
}
