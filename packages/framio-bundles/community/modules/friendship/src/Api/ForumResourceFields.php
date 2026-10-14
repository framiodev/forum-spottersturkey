<?php

declare(strict_types=1);

namespace forumaker\Friendship\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Settings\SettingsRepositoryInterface;

class ForumResourceFields
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Boolean::make('canAddFriends')
                ->get(fn ($model, Context $context) => $context->getActor()->hasPermission('friendship.addFriends')),
            Schema\Boolean::make('canViewOthersFriends')
                ->get(fn ($model, Context $context) => $context->getActor()->hasPermission('friendship.viewOthers')),
            Schema\Boolean::make('canModerateFriendships')
                ->get(fn ($model, Context $context) => $context->getActor()->hasPermission('friendship.moderate')
                    || $context->getActor()->hasPermission('friendship.manage')),
            Schema\Boolean::make('friendshipShowBadgeOnUserCard')
                ->get(fn () => (bool) $this->settings->get('forumaker-friendship.show_badge_on_usercard', true)),
            Schema\Boolean::make('friendshipShowBadgeOnPost')
                ->get(fn () => (bool) $this->settings->get('forumaker-friendship.show_badge_on_post', true)),
            Schema\Str::make('friendshipBadgeColor')
                ->get(fn () => $this->settings->get('forumaker-friendship.badge_color', '#45698D')),
            Schema\Str::make('friendshipBadgeBgColor')
                ->get(fn () => $this->settings->get('forumaker-friendship.badge_bg_color', '#45698D')),
            Schema\Str::make('friendshipBadgeIcon')
                ->get(fn () => $this->settings->get('forumaker-friendship.badge_icon', 'fas fa-hand-peace')),
        ];
    }
}
