<?php

/*
 * This file is part of fof/top-posters-widget.
 *
 * Copyright (c) 2021 FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\TopPosters;

use function Framio\Widgets\ForumWidgets\Helper\pretty_number_format;

class AddTopPostersToApi
{
    public function __construct(private UserRepository $repository) {}

    public function __invoke(): array
    {
        $data = $this->repository->getTopPosters();

        foreach ($data as $id => $count) {
            $data[$id] = pretty_number_format($count);
        }

        return $data;
    }
}
