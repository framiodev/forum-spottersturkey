<?php

namespace Framio\Moderation\AuthorChange;

use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema;
use Flarum\Discussion\Event\Saving as DiscussionSaving;
use Flarum\Extend;
use Flarum\Post\Event\Saving as PostSaving;

return [
    (new Extend\Locales(__DIR__.'/resources/locale')),

    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/resources/less/forum.less'),

    (new Extend\Event())
        ->listen(DiscussionSaving::class, Listeners\SaveDiscussion::class)
        ->listen(PostSaving::class, Listeners\SavePost::class),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('clarkwinkelmannAuthorChangeCanEditUser')
                ->get(fn ($forum, $context) => $context->getActor()->can('clarkwinkelmann-author-change.edit-user')),
            Schema\Boolean::make('clarkwinkelmannAuthorChangeCanEditDate')
                ->get(fn ($forum, $context) => $context->getActor()->can('clarkwinkelmann-author-change.edit-date')),
        ]),
];
