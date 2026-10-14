<?php

/*
 * This file is part of framio/community (mailing module).
 */

namespace Framio\Community\Mailing;

use Flarum\Api\Context;
use Flarum\Api\Resource;
use Flarum\Api\Schema;
use Flarum\Extend;

return [
    new Extend\Locales(__DIR__ . '/locale'),

    (new Extend\View())
        ->namespace('fof-mailing', __DIR__ . '/resources/views')
        ->namespace('framio-mailing', __DIR__ . '/resources/views'),

    (new Extend\Routes('api'))
        ->post('/admin-mail', 'fof.mailing.create-mail', Controllers\SendAdminEmailController::class)
        ->post('/framio/admin-mail', 'framio.mailing.create-mail', Controllers\SendAdminEmailController::class),

    (new Extend\ApiResource(Resource\ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('fofMailingCanMailAll')
                ->get(fn (object $forum, Context $context) => $context->getActor()->can('framio-mailing.mail-all') || $context->getActor()->can('fof-mailing.mail-all')),
            Schema\Boolean::make('fofMailingCanMailIndividual')
                ->get(fn (object $forum, Context $context) => $context->getActor()->can('framio-mailing.mail-individual') || $context->getActor()->can('fof-mailing.mail-individual')),
            Schema\Boolean::make('framioMailingCanMailAll')
                ->get(fn (object $forum, Context $context) => $context->getActor()->can('framio-mailing.mail-all') || $context->getActor()->can('fof-mailing.mail-all')),
            Schema\Boolean::make('framioMailingCanMailIndividual')
                ->get(fn (object $forum, Context $context) => $context->getActor()->can('framio-mailing.mail-individual') || $context->getActor()->can('fof-mailing.mail-individual')),
        ]),
];
