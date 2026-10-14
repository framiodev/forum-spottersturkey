<?php

/*
 * This file is part of framio/community (mailing module).
 * Adapted from fof/mailing.
 */

namespace Framio\Community\Mailing\Jobs;

use Flarum\Queue\AbstractJob;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Translation\Translator;
use Illuminate\Contracts\View\Factory;
use Illuminate\Mail\Mailer;
use Illuminate\Mail\Message;

class SendMail extends AbstractJob
{
    public function __construct(
        protected string ,
        protected string ,
        protected string ,
        protected string 
    ) {
        parent::__construct();
    }

    public function handle(SettingsRepositoryInterface , Mailer , Translator , Factory ): void
    {
         = ->get('forum_title');
         = ->email;
         = ->displayName;

        ->share(compact('forumTitle', 'userEmail', 'username'));

         = ->text;

         = ->trans('framio-mailing.email.default_subject');
        if ( === 'framio-mailing.email.default_subject') {
             = ->trans('fof-mailing.email.default_subject');
        }

         = '[' .  . '] ' . (->subject !== '' ? ->subject : );

        ->send(
            [
                'text' => 'framio-mailing::emails.plain.adminMail',
                'html' => 'framio-mailing::emails.html.adminMail',
            ],
            compact('infoContent'),
            function (Message ) use () {
                ->to(->email);
                ->subject();
            }
        );
    }
}
