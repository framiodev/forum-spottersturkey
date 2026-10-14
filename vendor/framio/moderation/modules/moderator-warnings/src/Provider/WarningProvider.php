<?php

/*
 * This file is part of fof/moderator-warnings
 *
 * Copyright (c) Alexander Skvortsov.
 * Copyright (c) FriendsOfFlarum
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

namespace Framio\Moderation\ModeratorWarnings\Provider;

use Flarum\Formatter\Formatter;
use Flarum\Foundation\AbstractServiceProvider;
use Framio\Moderation\ModeratorWarnings\Model\Warning;

class WarningProvider extends AbstractServiceProvider
{
    public function boot(Formatter $formatter): void
    {
        Warning::setFormatter($formatter);
    }
}
