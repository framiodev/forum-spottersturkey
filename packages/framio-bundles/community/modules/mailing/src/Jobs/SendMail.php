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
        protected string $email,
        protected string $displayName,
        protected string $subject,
        protected string $text
    ) {
        parent::__construct();
    }

    public function handle(SettingsRepositoryInterface $settings, Mailer $mailer, Translator $translator, Factory $view): void
    {
        $forumTitle = $settings->get('forum_title');
        $userEmail = $this->email;
        $username = $this->displayName;

        $view->share(compact('forumTitle', 'userEmail', 'username'));

        $infoContent = $this->text;

        $defaultSubject = $translator->trans('framio-mailing.email.default_subject');
        if ($defaultSubject === 'framio-mailing.email.default_subject') {
            $defaultSubject = $translator->trans('fof-mailing.email.default_subject');
        }

        $subject = '[' . $forumTitle . '] ' . ($this->subject !== '' ? $this->subject : $defaultSubject);

        $mailer->send(
            [
                'text' => 'framio-mailing::emails.plain.adminMail',
                'html' => 'framio-mailing::emails.html.adminMail',
            ],
            compact('infoContent'),
            function (Message $message) use ($subject) {
                $message->to($this->email);
                $message->subject($subject);
            }
        );
    }
}
