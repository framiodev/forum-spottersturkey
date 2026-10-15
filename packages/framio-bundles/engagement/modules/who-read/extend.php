<?php

namespace Framio\Engagement\WhoRead;

use Flarum\Api\Endpoint;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Discussion\Event\Saving;
use Flarum\Extend;
use Flarum\Settings\SettingsRepositoryInterface;

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/resources/less/forum.less'),

    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\Model(Discussion::class))
        ->relationship('clarkwinkelmannWhoReaders', DiscussionReaderRelationship::class),

    (new Extend\Event())
        ->listen(Saving::class, Listeners\SaveDiscussionUnread::class),

    (new Extend\ApiResource(Api\Resource\WhoReaderResource::class)),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(function () {
            return [
                Schema\Boolean::make('who-read.canSee')
                    ->get(function ($forum, $context) {
                        return $context->getActor()->hasPermission('who-read.seeRead');
                    }),
                Schema\Boolean::make('who-read.showInDiscussionList')
                    ->get(fn ($forum, $context) => (bool) resolve(SettingsRepositoryInterface::class)->get('who-read.showInDiscussionList', true)),
                Schema\Boolean::make('who-read.showInHero')
                    ->get(fn ($forum, $context) => (bool) resolve(SettingsRepositoryInterface::class)->get('who-read.showInHero', true)),
                Schema\Boolean::make('who-read.showBetweenPosts')
                    ->get(fn ($forum, $context) => (bool) resolve(SettingsRepositoryInterface::class)->get('who-read.showBetweenPosts', true)),
                Schema\Boolean::make('who-read.showCountOfReadersWhoStopped')
                    ->get(fn ($forum, $context) => (bool) resolve(SettingsRepositoryInterface::class)->get('who-read.showCountOfReadersWhoStopped', false)),
                Schema\Integer::make('who-read.hideWhenBehind')
                    ->get(fn ($forum, $context) => (int) resolve(SettingsRepositoryInterface::class)->get('who-read.hideWhenBehind', 0)),
                Schema\Integer::make('who-read.maxVisible')
                    ->get(fn ($forum, $context) => (int) resolve(SettingsRepositoryInterface::class)->get('who-read.maxVisible', 10)),
                Schema\Str::make('who-read.unreadIcon')
                    ->get(fn ($forum, $context) => resolve(SettingsRepositoryInterface::class)->get('who-read.unreadIcon') ?: 'fas fa-eye-slash'),
            ];
        }),

    // Konu sayfası ve okuma konumu kaydı okuyan listesini de döndürsün; yoksa mesaj altındaki sayaç hep 0 kalır
    (new Extend\ApiResource(DiscussionResource::class))
        ->endpoint(
            [Endpoint\Show::class, Endpoint\Update::class],
            function (Endpoint\Show|Endpoint\Update $endpoint): Endpoint\Endpoint {
                return $endpoint->addDefaultInclude(['clarkwinkelmannWhoReaders', 'clarkwinkelmannWhoReaders.user']);
            }
        ),

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(function () {
            return [
                Schema\Relationship\ToMany::make('clarkwinkelmannWhoReaders')
                    ->type('clarkwinkelmann-who-readers')
                    ->get(function (Discussion $discussion, $context) {
                        if (! $context->getActor()->hasPermission('who-read.seeRead')) {
                            return [];
                        }

                        // ->all() returns a plain array of the original UserState model
                        // objects. Returning the Collection itself would be turned into an
                        // array of attribute arrays by Schema\Relationship\ToMany::serializeValue()
                        // (it calls ->toArray() on anything Arrayable), which then crashes
                        // deeper in the serializer with "Argument #1 ($model) must be of type
                        // object, array given" -- see AbstractDatabaseResource::resource().
                        return $discussion->clarkwinkelmannWhoReaders->all();
                    })
                    ->includable(),

                Schema\Boolean::make('whoReadCanMarkUnread')
                    ->get(function (Discussion $discussion, $context) {
                        return $context->getActor()->hasPermission('who-read.markUnread');
                    }),

                Schema\Boolean::make('whoReadUnread')
                    ->visible(function (Discussion $discussion, $context) {
                        return $context->getActor()->hasPermission('who-read.markUnread') && $discussion->state !== null;
                    })
                    ->get(function (Discussion $discussion) {
                        return (bool) $discussion->state->who_read_unread;
                    })
                    ->writable(function (Discussion $discussion, $context) {
                        return $context->updating() && $context->getActor()->hasPermission('who-read.markUnread');
                    })
                    ->set(function (Discussion $discussion, bool $value, $context) {
                        // The actual saving and UserDataSaving event dispatch is handled by SaveDiscussionUnread listener
                        // or directly here if needed.
                        $state = $discussion->stateFor($context->getActor());
                        $state->who_read_unread = $value;
                        $state->save();
                    }),
            ];
        }),
];
