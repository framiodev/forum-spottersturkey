<?php

/*
 * This file is part of framio/community (mailing module).
 * Adapted from fof/mailing.
 */

namespace Framio\Community\Mailing\Controllers;

use Flarum\Foundation\ValidationException;
use Flarum\Group\Group;
use Flarum\Http\RequestUtil;
use Flarum\User\UserRepository;
use Framio\Community\Mailing\Jobs\SendMail;
use Illuminate\Contracts\Queue\Queue;
use Illuminate\Contracts\Translation\Translator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class SendAdminEmailController implements RequestHandlerInterface
{
    public function __construct(
        protected UserRepository ,
        protected Queue 
    ) {
    }

    public function handle(ServerRequestInterface ): ResponseInterface
    {
         = RequestUtil::getActor();

         = (array) Arr::get(->getParsedBody(), 'data');
         = collect((array) Arr::get(, 'recipients'));

         = ->filter(function () {
            return Arr::get(, 'type') === 'users';
        })->map(function () {
            return Arr::get(, 'id');
        })->toArray();

         = ->filter(function () {
            return in_array(Arr::get(, 'type'), ['fof-mailing-emails', 'framio-mailing-emails']);
        })->map(function () {
            return Arr::get(, 'attributes.email');
        })->toArray();

         = ->filter(function () {
            return Arr::get(, 'type') === 'groups';
        })->map(function () {
            return Arr::get(, 'id');
        })->toArray();

        if (count()) {
            if (!->can('framio-mailing.mail-all') && !->can('fof-mailing.mail-all')) {
                ->assertCan('fof-mailing.mail-all');
            }
        } else {
            if (!->can('framio-mailing.mail-individual') && !->can('fof-mailing.mail-individual')) {
                ->assertCan('fof-mailing.mail-individual');
            }
        }

         = ->users->query();

        if (!in_array(Group::MEMBER_ID, )) {
            ->whereIn('id', )
                ->orWhereHas('groups', function (Builder ) use () {
                    ->whereIn('groups.id', );
                });
        }

         = (string) Arr::get(, 'subject');
         = (string) Arr::get(, 'text');

         = 0;

        ->chunk(50, function () use (, , &) {
            foreach ( as ) {
                if (!empty(->email) && filter_var(->email, FILTER_VALIDATE_EMAIL)) {
                    ->queue->push(new SendMail(->email, ->display_name ?? ->username, , ));
                    ++;
                }
            }
        });

        foreach ( as ) {
            if (filter_var(, FILTER_VALIDATE_EMAIL)) {
                ->queue->push(new SendMail(, , , ));
                ++;
            }
        }

        if ( === 0) {
            /** @var Translator  */
             = resolve(Translator::class);

            throw new ValidationException([
                'recipients' => ->trans('framio-mailing.api.no_recipients'),
            ]);
        }

        return new JsonResponse([
            'recipientCount' => ,
        ]);
    }
}
