<?php

namespace Framio\UploadExif\PostAs;

use Flarum\Discussion\Event\Saving as DiscussionSaving;
use Flarum\Post\CommentPost;
use Flarum\Post\Event\Saving as PostSaving;
use Flarum\User\User;
use Illuminate\Support\Arr;

/**
 * Yönetici, imza penceresinde bir üye seçtiğinde konu ve mesaj doğrudan o üyenin
 * adına oluşturulur (sanki üye kendisi paylaşmış gibi). Sayaçlar, bildirimler ve
 * "son yazan" bilgileri de bu üyeye göre işler; çünkü sahiplik kayıt anından önce
 * değiştirilir ve Flarum olayları bu kayıttan sonra yayınlanır.
 *
 * İstek alanı: data.attributes.framioPostAs = hedef üye ID'si (yalnızca yöneticiler).
 */
class PostAsHandler
{
    /** Yeni konunun ilk mesajı ayrı bir iç istekle oluşturulduğu için hedef burada taşınır */
    protected static ?User $pendingFirstPostUser = null;

    public function discussion(DiscussionSaving $event): void
    {
        if ($event->discussion->exists) return;

        $target = $this->resolveTarget($event->actor, $event->data);
        if (!$target) return;

        $event->discussion->user_id = $target->id;
        $event->discussion->setRelation('user', $target);
        static::$pendingFirstPostUser = $target;
    }

    public function post(PostSaving $event): void
    {
        $post = $event->post;
        if ($post->exists || !$post instanceof CommentPost) return;

        $target = $this->resolveTarget($event->actor, $event->data) ?? static::$pendingFirstPostUser;
        static::$pendingFirstPostUser = null;
        if (!$target) return;

        $post->user_id = $target->id;
        $post->setRelation('user', $target);
    }

    protected function resolveTarget(User $actor, array $data): ?User
    {
        $id = (int) Arr::get($data, 'attributes.framioPostAs', 0);
        if ($id <= 0 || !$actor->isAdmin() || $id === (int) $actor->id) return null;

        return User::find($id);
    }
}
