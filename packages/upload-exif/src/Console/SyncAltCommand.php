<?php

namespace Framio\UploadExif\Console;

use Flarum\Post\CommentPost;
use Framio\UploadExif\Helpers\AltSync;
use Illuminate\Console\Command;

/** Geriye dönük: künyesi sonradan düzenlenmiş gönderilerde görsel alt metinlerini künyeyle eşitler */
class SyncAltCommand extends Command
{
    protected $signature = 'media:sync-alt {--dry : Yalnızca kaç gönderinin değişeceğini göster}';
    protected $description = 'Görsel alt metinlerini gönderinin künyesiyle eşitler (SEO)';

    public function handle(): int
    {
        $n = 0;
        CommentPost::query()->where('type', 'comment')
            ->where(fn ($q) => $q->where('content', 'like', '%[framio-image%')->orWhere('content', 'like', '%[ulasimarsiv-image%')->orWhere('content', 'like', '%[spotter-image%')
                ->orWhere('content', 'like', '%<FRAMIO-IMAGE%')->orWhere('content', 'like', '%<SPOTTER-IMAGE%')->orWhere('content', 'like', '%<ULASIMARSIV-IMAGE%'))
            ->chunkById(100, function ($posts) use (&$n) {
                foreach ($posts as $post) {
                    $content = (string) $post->content;
                    if (AltSync::rewrite($content) === $content) continue;
                    $n++;
                    if ($this->option('dry')) $this->line('#' . $post->id);
                    else AltSync::sync($post);
                }
            });
        $this->info(($this->option('dry') ? 'Değişecek gönderi: ' : 'Güncellenen gönderi: ') . $n);

        return 0;
    }
}
