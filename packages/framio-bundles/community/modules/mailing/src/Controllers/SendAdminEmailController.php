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
        protected UserRepository $users,
        protected Queue $queue
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        $data = (array) Arr::get($request->getParsedBody(), 'data');
        $recipients = collect((array) Arr::get($data, 'recipients'));

        $userIds = $recipients->filter(function ($model) {
            return Arr::get($model, 'type') === 'users';
        })->map(function ($model) {
            return Arr::get($model, 'id');
        })->toArray();

        $emails = $recipients->filter(function ($model) {
            return in_array(Arr::get($model, 'type'), ['fof-mailing-emails', 'framio-mailing-emails']);
        })->map(function ($model) {
            return Arr::get($model, 'attributes.email');
        })->toArray();

        $groupIds = $recipients->filter(function ($model) {
            return Arr::get($model, 'type') === 'groups';
        })->map(function ($model) {
            return Arr::get($model, 'id');
        })->toArray();

        if (count($groupIds)) {
            if (!$actor->can('framio-mailing.mail-all') && !$actor->can('fof-mailing.mail-all')) {
                $actor->assertCan('fof-mailing.mail-all');
            }
        } else {
            if (!$actor->can('framio-mailing.mail-individual') && !$actor->can('fof-mailing.mail-individual')) {
                $actor->assertCan('fof-mailing.mail-individual');
            }
        }

        $userQuery = $this->users->query();

        if (!in_array(Group::MEMBER_ID, $groupIds)) {
            $userQuery->whereIn('id', $userIds)
                ->orWhereHas('groups', function (Builder $query) use ($groupIds) {
                    $query->whereIn('groups.id', $groupIds);
                });
        }

        $subject = (string) Arr::get($data, 'subject');
        $text = (string) Arr::get($data, 'text');

        $recipientCount = 0;

        $userQuery->chunk(50, function ($users) use ($subject, $text, &$recipientCount) {
            foreach ($users as $user) {
                if (!empty($user->email) && filter_var($user->email, FILTER_VALIDATE_EMAIL)) {
                    $this->queue->push(new SendMail($user->email, $user->display_name ?? $user->username, $subject, $text));
                    $recipientCount++;
                }
            }
        });

        foreach ($emails as $email) {
            if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $this->queue->push(new SendMail($email, $email, $subject, $text));
                $recipientCount++;
            }
        }

        if ($recipientCount === 0) {
            /** @var Translator $translator */
            $translator = resolve(Translator::class);

            throw new ValidationException([
                'recipients' => $translator->trans('framio-mailing.api.no_recipients'),
            ]);
        }

        return new JsonResponse([
            'recipientCount' => $recipientCount,
        ]);
    }
}
