<?php

/*
 * This file is part of fof/move-posts.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\MovePosts\Formatter;

use Psr\Http\Message\ServerRequestInterface as Request;
use s9e\TextFormatter\Renderer;
use s9e\TextFormatter\Utils;

class FormatPostMentions
{
    public function __invoke(Renderer $renderer, mixed $context, string $xml, ?Request $request = null): string
    {
        $post = $context;

        return Utils::replaceAttributes($xml, 'POSTMENTION', function ($attributes) use ($post) {
            $post = $post->mentionsPosts->find($attributes['id']);

            if ($post) {
                $attributes['number'] = $post->number;
                $attributes['discussionid'] = $post->discussion_id;
            }

            return $attributes;
        });
    }
}
