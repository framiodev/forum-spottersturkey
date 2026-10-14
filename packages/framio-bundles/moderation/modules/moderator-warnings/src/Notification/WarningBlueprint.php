<?php

/*
 * This file is part of fof/moderator-warnings
 *
 * Copyright (c) Alexander Skvortsov.
 * Copyright (c) FriendsOfFlarum
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

namespace Framio\Moderation\ModeratorWarnings\Notification;

use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\Notification\MailableInterface;
use Framio\Moderation\ModeratorWarnings\Model\Warning;

class WarningBlueprint implements BlueprintInterface, MailableInterface, AlertableInterface
{
    public function __construct(public Warning $warning)
    {
    }

    /**
     * {@inheritdoc}
     */
    public function getSubject(): ?\Flarum\Database\AbstractModel
    {
        return $this->warning;
    }

    /**
     * {@inheritdoc}
     */
    public function getFromUser(): ?\Flarum\User\User
    {
        return $this->warning->addedByUser;
    }

    /**
     * {@inheritdoc}
     */
    public function getData(): mixed
    {
        return [];
    }

    /**
     * {@inheritdoc}
     */
    public function getEmailViews(): array
    {
        return ['text' => 'fof-moderator-warnings::emails.plain.warning', 'html' => 'fof-moderator-warnings::emails.html.warning'];
    }

    /**
     * {@inheritdoc}
     */
    public function getEmailSubject(\Flarum\Locale\TranslatorInterface $translator): string
    {
        return $translator->trans($this->getTranslation().'.subject', [
            '{warner_display_name}' => $this->warning->addedByUser->display_name,
            '{strikes}' => $this->warning->strikes,
            '{discussion_title}' => $this->warning->post ? $this->warning->post->discussion->title : '',
        ]);
    }

    public function getTranslation(): string
    {
        return 'fof-moderator-warnings.emails.'.($this->warning->post_id ? 'post_warned' : 'user_warned');
    }

    public function getUnparsedComment(): string
    {
        return Warning::getFormatter()->unparse($this->warning->public_comment);
    }

    /**
     * {@inheritdoc}
     */
    public static function getType(): string
    {
        return 'warning';
    }

    /**
     * {@inheritdoc}
     */
    public static function getSubjectModel(): string
    {
        return Warning::class;
    }
}
