<?php

namespace Framio\Community\Notifications\Broadcast;

use Flarum\Database\AbstractModel;
use Flarum\Locale\TranslatorInterface;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\Notification\MailableInterface;
use Flarum\Post\Post;
use Flarum\User\User;

/**
 * Grup duyurusuyla aynı anda üyelere giden site bildirimi: "Forumda N yeni paylaşım".
 * Konu = duyurudaki ilk mesaj. Site içi bildirim, tarayıcı (push, PWA) ve
 * isteğe bağlı e-posta kanallarından üyenin seçtikleriyle gider.
 */
class HighlightBlueprint implements BlueprintInterface, MailableInterface, AlertableInterface
{
    /** @param string[] $lines */
    public function __construct(public Post $post, public int $count, public string $label = '')
    {
    }

    public function getSubject(): ?AbstractModel
    {
        return $this->post;
    }

    public function getFromUser(): ?User
    {
        return null;
    }

    public function getData(): mixed
    {
        return ['count' => $this->count, 'label' => $this->label];
    }

    public static function getType(): string
    {
        return 'communityHighlight';
    }

    public static function getSubjectModel(): string
    {
        return Post::class;
    }

    public function getEmailViews(): array
    {
        return ['text' => 'framio-broadcast::email.plain.highlight', 'html' => 'framio-broadcast::email.html.highlight'];
    }

    public function getEmailSubject(TranslatorInterface $translator): string
    {
        return $this->count > 1
            ? $this->count . ' yeni paylaşım: ' . ($this->label ?: $this->post->discussion->title)
            : 'Yeni paylaşım: ' . ($this->label ?: $this->post->discussion->title);
    }
}
