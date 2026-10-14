<?php

/*
 * This file is part of justoverclock/flarum-ext-socialcards.
 *
 * Copyright (c) 2021 Marco Colia.
 * https://flarum.it
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace Framio\Widgets\SocialCards;

use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/resources/less/forum.less'),
    (new Extend\Frontend('admin'))
        ->css(__DIR__.'/resources/less/admin.less'),
    new Extend\Locales(__DIR__.'/resources/locale'),
    (new Extend\Settings())->serializeToForum('ShowFacebook', 'justoverclock-socialcards.hide.facebook', 'boolval', false),
    (new Extend\Settings())->serializeToForum('ShowYoutube', 'justoverclock-socialcards.hide.youtube', 'boolval', false),
    (new Extend\Settings())->serializeToForum('ShowTwitter', 'justoverclock-socialcards.hide.twitter', 'boolval', false),
    (new Extend\Settings())->serializeToForum('ShowGithub', 'justoverclock-socialcards.hide.github', 'boolval', false),
    (new Extend\Settings())->serializeToForum('fblink', 'justoverclock-guestengagement.fblink'),
    (new Extend\Settings())->serializeToForum('ytlink', 'justoverclock-guestengagement.ytlink'),
    (new Extend\Settings())->serializeToForum('twlink', 'justoverclock-guestengagement.twlink'),
    (new Extend\Settings())->serializeToForum('ghlink', 'justoverclock-guestengagement.ghlink'),
];
