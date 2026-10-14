<?php

namespace Framio\PostComments;

use Flarum\Api\Resource\PostResource;
use Flarum\Api\Schema;
use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/dist/forum.js')
        ->css(__DIR__ . '/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__ . '/js/dist/admin.js'),

    (new Extend\Routes('api'))
        ->get('/post-comments', 'post-comments.index', Api\CommentsController::class)
        ->post('/post-comments', 'post-comments.create', Api\CommentsController::class)
        ->patch('/post-comments/{id:\d+}', 'post-comments.update', Api\CommentsController::class)
        ->delete('/post-comments/{id:\d+}', 'post-comments.delete', Api\CommentsController::class)
        ->post('/post-comments/{id:\d+}/like', 'post-comments.like', Api\CommentsController::class),

    (new Extend\Notification())
        ->type(Notification\PostCommentedBlueprint::class, ['alert'])
        ->type(Notification\CommentRepliedBlueprint::class, ['alert']),

    // "Yorumlar (3)" ve mesaj altındaki son yorum önizlemesi
    (new Extend\ApiResource(PostResource::class))
        ->fields(fn () => [
            Schema\Integer::make('postCommentCount')
                ->get(fn ($post) => $post->type === 'comment' ? PostComment::where('post_id', $post->id)->count() : 0),
            Schema\Arr::make('postCommentPreview')
                ->nullable()
                ->get(function ($post) {
                    if ($post->type !== 'comment') {
                        return null;
                    }
                    $c = PostComment::with('user')->where('post_id', $post->id)->whereNull('parent_id')
                        ->orderByDesc('created_at')->orderByDesc('id')->first();
                    if (!$c) {
                        return null;
                    }

                    return [
                        'name' => $c->user ? ($c->user->display_name ?: $c->user->username) : ($c->guest_name ?: 'Ziyaretçi'),
                        'avatarUrl' => $c->user?->avatar_url,
                        'text' => mb_substr($c->content, 0, 160),
                    ];
                }),
        ]),

    (new Extend\Settings())
        ->default('framio-post-comments.allow_guests', '1')
        ->default('framio-post-comments.show_preview', '1')
        ->default('framio-post-comments.max_length', '1000')
        ->default('framio-post-comments.user_interval', '10')
        ->default('framio-post-comments.guest_interval', '30')
        ->default('framio-post-comments.guest_hourly', '10')
        ->serializeToForum('framioPostCommentsGuests', 'framio-post-comments.allow_guests', 'boolval')
        ->serializeToForum('framioPostCommentsPreview', 'framio-post-comments.show_preview', 'boolval'),
];
