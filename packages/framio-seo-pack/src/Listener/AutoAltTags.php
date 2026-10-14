<?php

namespace Framio\SeoPack\Listener;

use Flarum\Post\CommentPost;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Revised;
use Framio\SeoPack\Support\AltTextFixer;
use Framio\SeoPack\Support\SeoSettings;

/**
 * Yeni/düzenlenen mesajlarda alt metni boş kalan görsellere künyeden
 * alt metin yazar. Kullanıcının kendi yazdığı alt metne dokunmaz.
 */
class AutoAltTags
{
    public function __construct(protected AltTextFixer $fixer, protected SeoSettings $seo)
    {
    }

    public function whenPostCreated(Posted $event): void
    {
        $this->handle($event->post);
    }

    public function whenPostRevised(Revised $event): void
    {
        $this->handle($event->post);
    }

    protected function handle($post): void
    {
        if ($post instanceof CommentPost && $this->seo->bool('enable_auto_alt')) {
            try {
                $this->fixer->fix($post, false);
            } catch (\Throwable $e) {
                // Alt metin üretimi mesaj kaydını asla engellememeli
            }
        }
    }
}
