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

use s9e\TextFormatter\Utils;

class UnparsePostMentions
{
    public function __invoke(mixed $context, ?string $xml): ?string
    {
        if (! $xml) {
            return null;
        }

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
