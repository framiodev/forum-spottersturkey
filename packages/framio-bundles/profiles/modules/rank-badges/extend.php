<?php

/*
 * This file is part of hazbin/rank-badges.
 *
 * Copyright (c) Hazbin Foundation.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace Framio\Profiles\RankBadges;

use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/less/forum.less'),
];
