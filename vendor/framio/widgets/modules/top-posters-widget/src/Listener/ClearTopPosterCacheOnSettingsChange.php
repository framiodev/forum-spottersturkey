<?php

namespace FoF\TopPosters\Listener;

use FoF\TopPosters\UserRepository;
use Flarum\Settings\Event\Saved;
use Illuminate\Support\Arr;

class ClearTopPosterCacheOnSettingsChange
{
    public function __construct(private UserRepository $repository) {}

    public function handle(Saved $event): void
    {
        if (Arr::get($event->settings, 'fof-top-posters-widget.excludeGroups')) {
            $this->repository->clearTopPosterCache();
        }
    }
}
