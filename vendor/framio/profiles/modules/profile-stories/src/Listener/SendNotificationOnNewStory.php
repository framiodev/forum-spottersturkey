<?php

namespace Framio\Profiles\ProfileStories\Listener;

use Flarum\Notification\NotificationSyncer;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Framio\Profiles\ProfileStories\Event\StoryCreated;
use Framio\Profiles\ProfileStories\Notification\NewStoryNotificationBlueprint;
use Symfony\Contracts\Translation\TranslatorInterface;

class SendNotificationOnNewStory
{
    protected NotificationSyncer $notifications;
    protected TranslatorInterface $translator;
    protected SettingsRepositoryInterface $settings;

    public function __construct(NotificationSyncer $notifications, TranslatorInterface $translator, SettingsRepositoryInterface $settings)
    {
        $this->notifications = $notifications;
        $this->translator = $translator;
        $this->settings = $settings;
    }

    public function handle(StoryCreated $event)
    {
        $data = $event->data;
        $recipient = User::query()->where('username', $data['username'])->first();
        $this->notifications->sync(
            new NewStoryNotificationBlueprint($data),
            [$recipient]
        );
    }
}
