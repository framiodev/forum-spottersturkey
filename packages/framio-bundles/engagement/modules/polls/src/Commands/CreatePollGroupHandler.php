<?php

/*
 * This file is part of fof/polls.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Framio\Engagement\Polls\Commands;

use Framio\Engagement\Polls\Events\SavedPollGroup;
use Framio\Engagement\Polls\Events\SavingPollGroup;
use Framio\Engagement\Polls\PollGroup;
use Framio\Engagement\Polls\PollGroupRepository;
use Framio\Engagement\Polls\Validators\PollGroupValidator;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Arr;

class CreatePollGroupHandler
{
    public function __construct(protected PollGroupRepository $pollGroups, protected PollGroupValidator $validator, protected Dispatcher $events)
    {
    }

    public function handle(CreatePollGroup $command): PollGroup
    {
        $actor = $command->actor;
        $data = $command->data;
        $attributes = Arr::get($data, 'attributes', []);

        $actor->assertCan('startPollGroup');

        $this->validator->assertValid($data);

        $group = $this->pollGroups->createPollGroup($actor, $attributes['name']);

        $this->events->dispatch(new SavingPollGroup($actor, $group, $data));

        $group->save();

        $this->events->dispatch(new SavedPollGroup($actor, $group, $data));

        return $group;
    }
}
