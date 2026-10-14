<?php

/*
 * This file is part of fof/bookmarks.
 *
 * Copyright (c) 2026 FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\Bookmarks;

use Carbon\Carbon;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Discussion\Search\DiscussionSearcher;
use Flarum\Discussion\UserState;
use Flarum\Extend;
use Flarum\Post\Event\Deleted as PostDeleted;
use Flarum\Post\Filter\PostSearcher;
use Flarum\Post\Post;
use Flarum\Search\Database\DatabaseSearchDriver;
use Flarum\User\User;

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/less/forum.less')
        ->route('/bookmarks', 'fof-bookmarks'),

    new Extend\Locales(__DIR__.'/locale'),

    // Discussion bookmarks are stored as a timestamp on core's `discussion_user`
    // state table, so they ride along with the state relationship core already loads.
    // Core's UserState only declares `last_read_at` as a date, so the column has to be
    // cast here to come back as a Carbon instance rather than a raw string.
    (new Extend\Model(UserState::class))
        ->cast('bookmarked_at', 'datetime'),

    (new Extend\ApiResource(Resource\DiscussionResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('bookmarked')
                ->get(function (Discussion $discussion): bool {
                    return $discussion->state ? ! is_null($discussion->state->bookmarked_at) : false;
                })
                // Left writable for guests so that an unauthenticated write is rejected by
                // `assertRegistered()` below with a 401, rather than being silently dropped
                // as a non-writable field.
                ->writable()
                // The state row belongs to the actor rather than the discussion, so it is
                // written after the discussion itself has been saved.
                ->save(function (Discussion $discussion, bool $value, Context $context): void {
                    $actor = $context->getActor();

                    $actor->assertRegistered();

                    $state = $discussion->stateFor($actor);
                    $state->bookmarked_at = $value ? Carbon::now() : null;
                    $state->save();
                }),
        ])
        // The discussion endpoints serialize their posts through the post resource, so the
        // actor-scoped bookmark state has to be loaded for those nested posts too.
        ->endpoint(['index', 'show', 'create', 'update'], function (Endpoint\Endpoint $endpoint): Endpoint\Endpoint {
            return $endpoint
                ->eagerLoad('posts.bookmarkState')
                ->eagerLoadWhere('posts.bookmarkState', new ScopeBookmarkState());
        }),

    (new Extend\Event())
        ->listen(PostDeleted::class, Listeners\DeleteBookmarksOnPostDeletion::class),

    // Post bookmarks have no core-provided state row, so they use their own pivot
    // table plus an actor-scoped relationship to expose the current state.
    (new Extend\Model(Post::class))
        ->belongsToMany('bookmarks', User::class, 'post_user_bookmark', 'post_id', 'user_id')
        ->hasOne('bookmarkState', BookmarkState::class, 'post_id'),

    (new Extend\ApiResource(Resource\PostResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('bookmarked')
                ->get(function (Post $post): bool {
                    // `bookmarkState` is eager-loaded and scoped to the actor by the
                    // endpoint mutators below, so this is a relation read rather than a
                    // query. The relation is null when the actor has not bookmarked the post.
                    //
                    // `getRelation()` is used in preference to the magic property because
                    // flarum/phpstan types hasOne relations added by `Extend\Model` as
                    // non-nullable, which makes a null check on the property look redundant.
                    return $post->relationLoaded('bookmarkState') && $post->getRelation('bookmarkState') !== null;
                })
                // Left writable for guests so that an unauthenticated write is rejected by
                // `assertRegistered()` below with a 401, rather than being silently dropped
                // as a non-writable field.
                ->writable()
                // Written with `save()` rather than `set()` because the pivot row needs the
                // post's ID, which does not exist until a newly created post is saved.
                ->save(function (Post $post, bool $value, Context $context): void {
                    $actor = $context->getActor();

                    $actor->assertRegistered();

                    if ($value) {
                        // `syncWithoutDetaching` is idempotent, so bookmarking an
                        // already-bookmarked post is a no-op rather than a duplicate key error.
                        $post->bookmarks()->syncWithoutDetaching([$actor->id]);
                    } else {
                        $post->bookmarks()->detach($actor->id);
                    }

                    // The relation was eager-loaded (or absent) before this write, so it is
                    // refreshed to keep the serialized `bookmarked` value in step with what
                    // was just persisted.
                    $post->setRelation(
                        'bookmarkState',
                        $value ? $post->bookmarkState()->where('user_id', $actor->id)->first() : null
                    );
                }),
        ])
        // Every endpoint that serializes posts needs the actor-scoped bookmark state
        // eager-loaded, otherwise `bookmarked` above would fall back to `false`.
        ->endpoint(['index', 'show', 'create', 'update'], function (Endpoint\Endpoint $endpoint): Endpoint\Endpoint {
            return $endpoint
                ->eagerLoad('bookmarkState')
                ->eagerLoadWhere('bookmarkState', new ScopeBookmarkState());
        }),

    // Defaults are registered so every setting has a usable value in the forum payload
    // before an admin has ever opened the extension page.
    (new Extend\Settings())
        ->default('fof-bookmarks.independentButton', '1')
        ->default('fof-bookmarks.postButtonPosition', 'header')
        ->default('fof-bookmarks.postHeaderBadge', '0')
        ->serializeToForum('fof-bookmarks.independentButton', 'fof-bookmarks.independentButton', 'boolval')
        ->serializeToForum('fof-bookmarks.postButtonPosition', 'fof-bookmarks.postButtonPosition')
        ->serializeToForum('fof-bookmarks.postHeaderBadge', 'fof-bookmarks.postHeaderBadge', 'boolval'),
    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addFilter(DiscussionSearcher::class, Search\Filter\DiscussionBookmarkedFilter::class)
        ->addFilter(PostSearcher::class, Search\Filter\PostBookmarkedFilter::class)
        // fof/blog hides blog-tagged discussions from every discussion listing, which
        // would silently drop bookmarked articles from the bookmarks page.
        ->addMutator(DiscussionSearcher::class, Search\AllowBlogArticlesWhenFilteringBookmarks::class),
];
