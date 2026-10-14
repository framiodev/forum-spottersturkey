<?php

namespace Framio\Profiles\Signature;

use Flarum\Api\Context;
use Flarum\Api\Resource\UserResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Flarum\User\Event\Saving as UserSaving;
use Flarum\User\User;
use Framio\Profiles\Signature\Formatter\SignatureFormatter;

require_once __DIR__.'/src/Formatter/SignatureFormatter.php';
require_once __DIR__.'/src/Provider/SignatureFormatterProvider.php';

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/resources/less/forum.less')
        ->route('/u/{username}/signature', 'user.signature'),

    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\Event())
        ->listen(UserSaving::class, Listener\SaveSignatureToDatabase::class),

    (new Extend\Settings())
        ->default('signature.maximum_char_limit', 500)
        ->default('signature.maximum_image_count', 2)
        ->default('signature.allow_inline_editing', false)
        ->serializeToForum('allowInlineEditing', 'signature.allow_inline_editing', 'boolval'),

    (new Extend\Model(User::class))
        ->cast('signature', 'string'),

    (new Extend\Policy())
        ->modelPolicy(User::class, Access\UserPolicy::class),

    (new Extend\ServiceProvider())
        ->register(Provider\SignatureFormatterProvider::class),

    (new Extend\ApiResource(UserResource::class))
        ->fields(fn () => [
            Schema\Str::make('signature')
                ->get(fn (User $user) => $user->signature ? resolve(SignatureFormatter::class)->unparse($user->signature) : null),
            Schema\Str::make('signatureHtml')
                ->get(fn (User $user) => $user->signature ? resolve(SignatureFormatter::class)->render($user->signature) : null),
            Schema\Boolean::make('canEditSignature')
                ->get(fn (User $user, Context $context) => $context->getActor()->can('editSignature', $user)),
            Schema\Boolean::make('canHaveSignature')
                ->get(fn (User $user) => $user->hasPermission('haveSignature')),
        ]),
];
