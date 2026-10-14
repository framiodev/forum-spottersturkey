<?php

namespace Framio\General\Debug;

use Flarum\Foundation\ErrorHandling\Reporter;
use Throwable;

/** Flarum'un yakalayamadığı (500) her hatayı günlüğe yazar; debug kapalıyken de çalışır */
class DebugReporter implements Reporter
{
    public function __construct(protected DebugLog $log)
    {
    }

    public function report(Throwable $error): void
    {
        RequestContext::$reported = true;
        $this->log->recordException($error, RequestContext::$request);
    }
}
