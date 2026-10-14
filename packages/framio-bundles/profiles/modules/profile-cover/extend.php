<?php

namespace Framio\Profiles\ProfileCover;

use Flarum\Api\Context;
use Flarum\Api\Resource\UserResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Flarum\Foundation\Paths;
use Flarum\Http\UrlGenerator;
use Flarum\User\User;
use Illuminate\Contracts\Filesystem\Factory;

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/resources/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->css(__DIR__.'/resources/less/admin.less'),

    (new Extend\Routes('api'))
        ->post('/users/{id}/cover', 'users.cover.upload', Controller\UploadCoverController::class)
        ->delete('/users/{id}/cover', 'users.cover.delete', Controller\DeleteCoverController::class),

    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\Settings())
        ->serializeToForum('sycho-profile-cover.max_size', 'sycho-profile-cover.max_size'),

    (new Extend\Policy())
        ->modelPolicy(User::class, Access\UserPolicy::class),

    (new Extend\Filesystem())
        ->disk('sycho-profile-cover', function (Paths $paths, UrlGenerator $url) {
            return [
                'root' => "$paths->public/assets/covers",
                'url' => $url->to('forum')->path('assets/covers'),
            ];
        }),

    (new Extend\Model(User::class))
        ->cast('cover_focal_x', 'integer')
        ->cast('cover_focal_y', 'integer')
        ->cast('cover_zoom', 'float'),

    (new Extend\ApiResource(UserResource::class))
        ->fields(function () {
            $disk = fn () => resolve(Factory::class)->disk('sycho-profile-cover');

            return [
                Schema\Str::make('cover')
                    ->get(fn (User $user) => $user->cover ? $disk()->url($user->cover) : $user->cover),
                Schema\Str::make('cover_thumbnail')
                    ->get(function (User $user) use ($disk) {
                        if (empty($user->cover)) {
                            return null;
                        }

                        return $disk()->url('thumbnails/'.$user->cover);
                    }),
                Schema\Integer::make('cover_focal_x')
                    ->property('cover_focal_x')
                    ->nullable()
                    ->writable(fn (User $user, Context $context) => $context->getActor()->can('setProfileCover', $user)),
                Schema\Integer::make('cover_focal_y')
                    ->property('cover_focal_y')
                    ->nullable()
                    ->writable(fn (User $user, Context $context) => $context->getActor()->can('setProfileCover', $user)),
                Schema\Number::make('cover_zoom')
                    ->property('cover_zoom')
                    ->nullable()
                    ->writable(fn (User $user, Context $context) => $context->getActor()->can('setProfileCover', $user)),
                Schema\Boolean::make('canSetProfileCover')
                    ->get(fn (User $user, Context $context) => $context->getActor()->can('setProfileCover', $user)),
            ];
        }),
];
