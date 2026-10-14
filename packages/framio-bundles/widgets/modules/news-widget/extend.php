<?php

/*
 * This file is part of fof/news-widget.
 *
 * Copyright (c) 2026 FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\News;

use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->css(__DIR__.'/less/admin.less'),

    new Extend\Locales(__DIR__.'/locale'),

    (new Extend\Settings())
        ->serializeToForum('fof-news-widget.lines', 'fof-news-widget.lines', function (?string $value): array {
            // @todo a proper implementation would be to use a separate table to store the news lines.
            return $value ? json_decode($value, true) : [];
        }),
];
