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

use Framio\Engagement\Polls\Events\DeletedPollGroup;
use Framio\Engagement\Polls\Events\DeletingPollGroup;
use Framio\Engagement\Polls\PollGroup;
use Illuminate\Contracts\Events\Dispatcher;

class DeletePollGroupHandler
{
    public function __construct(protected Dispatcher $events)
    {
    }

    public function handle(DeletePollGroup $command): PollGroup
    {
        $actor = $command->actor;
        $group = PollGroup::findOrFail($command->groupId);

        $actor->assertCan('delete', $group);

        $this->events->dispatch(new DeletingPollGroup($actor, $group));

        $group->delete();

        $this->events->dispatch(new DeletedPollGroup($actor, $group));

        return $group;
    }
}
