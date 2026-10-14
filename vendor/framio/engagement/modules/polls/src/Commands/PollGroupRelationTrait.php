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

use Flarum\User\User;
use Framio\Engagement\Polls\Poll;
use Framio\Engagement\Polls\PollGroup;
use Illuminate\Support\Arr;

trait PollGroupRelationTrait
{
    protected function setPollGroupRelationData(User $actor, ?Poll $poll, array $data): void
    {
        $pollGroupData = Arr::get($data, 'relationships.pollGroup.data', []);

        if (empty($pollGroupData)) {
            return;
        }

        $group = PollGroup::findOrFail($pollGroupData['id']);
        $actor->assertCan('edit', $group);

        if ($poll) {
            $poll->pollGroup()->associate($group);
        }
    }
}
