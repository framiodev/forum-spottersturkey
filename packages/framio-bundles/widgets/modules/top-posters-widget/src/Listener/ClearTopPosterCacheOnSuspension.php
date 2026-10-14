<?php

namespace FoF\TopPosters\Listener;

use FoF\TopPosters\UserRepository;
use Flarum\User\Event\Saving;

class ClearTopPosterCacheOnSuspension
{
    public function __construct(private UserRepository $repository) {}

    public function handle(Saving $event): void
    {
        if ($event->user->isDirty('suspended_until')) {
            $this->repository->clearTopPosterCache();
        }
    }
}
