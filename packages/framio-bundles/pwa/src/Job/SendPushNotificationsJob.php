<?php

/*
 * This file is part of fof/pwa
 *
 * Copyright (c) 2021 Alexander Skvortsov.
 * Copyright (c) 2025 FriendsOfFlarum
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

namespace Framio\PWA\Job;

use ErrorException;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\Queue\AbstractJob;
use Framio\PWA\FirebasePushSender;
use Framio\PWA\PushSender;

class SendPushNotificationsJob extends AbstractJob
{
    public function __construct(private BlueprintInterface $blueprint, private array $recipientIds = [])
    {
    }

    /**
     * @throws ErrorException
     */
    public function handle(PushSender $native, FirebasePushSender $firebase): void
    {
        $native->notify($this->blueprint, $this->recipientIds);

        $firebase->notify($this->blueprint, $this->recipientIds);
    }
}
