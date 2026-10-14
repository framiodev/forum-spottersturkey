<?php

/*
 * This file is part of fof/moderator-notes.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Framio\Moderation\ModeratorNotes\Provider;

use Flarum\Formatter\Formatter;
use Flarum\Foundation\AbstractServiceProvider;
use Framio\Moderation\ModeratorNotes\Model\ModeratorNote;

class ModeratorNotesProvider extends AbstractServiceProvider
{
    public function boot(Formatter $formatter)
    {
        ModeratorNote::setFormatter($formatter);
    }
}
