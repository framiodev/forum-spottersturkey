<?php

namespace Framio\Profiles\ProfileStories;

use Flarum\Api\Context;
use Flarum\Api\Resource\UserResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Flarum\User\User;

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/resources/less/forum.less')
        ->route('/all-users-stories', 'justoverclock/profile-stories'),

    (new Extend\Frontend('admin'))
        ->css(__DIR__.'/resources/less/admin.less'),

    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\Model(User::class))
        ->hasMany('stories', Model\Story::class),

    (new Extend\Model(Model\Story::class))
        ->belongsTo('user', User::class, 'user_id'),

    (new Extend\Notification())
        ->type(Notification\NewStoryNotificationBlueprint::class, ['alert']),

    (new Extend\Routes('api'))
        ->get('/stories', 'stories.list', Controller\GetStories::class)
        ->get('/global-stories', 'globalstories.index', Controller\GlobalStories::class)
        ->patch('/stories/{id}', 'stories.update', Controller\UpdateStoryController::class)
        ->post('/create-story', 'create.story', Controller\CreateStoryController::class)
        ->delete('/delete-story/{id}', 'delete.story', Controller\DeleteStoryController::class)
        ->post('/banner/upload', 'banner.upload', Controller\BannerUploadController::class),

    (new Extend\Event())
        ->listen(Event\StoryCreated::class, Listener\SendNotificationOnNewStory::class, 'handle'),

    (new Extend\Settings)
        ->serializeToForum('justoverclock-profile-stories.imagePreview', 'justoverclock-profile-stories.imagePreview'),

    (new Extend\ApiResource(UserResource::class))
        ->fields(fn () => [
            Schema\Integer::make('storyCount')
                ->visible(fn (User $user, Context $context) => ! $context->getActor()->isGuest())
                ->get(fn (User $user) => $user->stories()->count()),
            Schema\Boolean::make('canCreateStory')
                ->get(fn (User $user, Context $context) => $context->getActor()->can('createStory', $user)),
            Schema\Boolean::make('canViewGlobalStories')
                ->get(fn (User $user, Context $context) => $context->getActor()->can('viewStory', $user)),
            Schema\Boolean::make('canDeleteStory')
                ->get(fn (User $user, Context $context) => $context->getActor()->can('deleteStory', $user)),
            Schema\Boolean::make('canEditStory')
                ->get(fn (User $user, Context $context) => $context->getActor()->can('editStory', $user)),
        ]),
];
