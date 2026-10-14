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

use Flarum\Api\Context;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;

class LoadForumTopPostersRelationship
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected UserRepository $repository
    ) {}

    public function __invoke(mixed $model, Context $context): array
    {
        $loadWithInitialResponse = $this->settings->get('fof-forum-widgets-core.prefer_data_with_initial_load', false);

        if (! $loadWithInitialResponse) {
            return [];
        }

        $counts = $this->repository->getTopPosters();

        return User::query()
            ->whereVisibleTo($context->getActor())
            ->whereIn('id', array_keys($counts))
            ->get()
            ->all();
    }
}
