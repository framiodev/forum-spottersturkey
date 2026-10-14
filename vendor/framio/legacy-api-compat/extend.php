<?php

use Flarum\Extend;
use Framio\LegacyApiCompat\SetLegacyActorAttribute;

return [
    (new Extend\Middleware('api'))
        ->insertBefore(\Flarum\Api\Middleware\ThrottleApi::class, SetLegacyActorAttribute::class),
];
