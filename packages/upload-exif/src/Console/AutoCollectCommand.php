<?php

namespace Framio\UploadExif\Console;

use Flarum\Settings\SettingsRepositoryInterface;
use Framio\UploadExif\Ai\AutoCollect;
use Illuminate\Console\Command;

/**
 * Otomatik koleksiyon: etkin kuralların her biri için, kural eklendikten SONRA gelen fotoğraflı gönderiler sorulur
 * ve "evet" (yüksek/orta güven) alanlar hedef başlığa eklenir. Geçmiş gönderiler admin'deki önizlemeyle taranır.
 */
class AutoCollectCommand extends Command
{
    protected $signature = 'media:auto-collect {--limit=20 : Kural başına en çok yeni gönderi} {--backfill=30 : Geçmiş taraması açık kurallarda, çalışma başına en çok eski gönderi}';
    protected $description = 'Yeni fotoğraflı gönderileri otomatik koleksiyon başlıklarına ekler (yapay zekâ kararıyla)';

    public function handle(AutoCollect $auto, SettingsRepositoryInterface $settings): int
    {
        if (!$auto->ready()) return 0;
        $starts = (array) json_decode((string) $settings->get('framio-upload-exif.auto_collect_start', '{}'), true);
        $maxId = (int) \Flarum\Post\Post::max('id');
        $changed = false;
        foreach ($auto->rules() as $rule) {
            if (!$rule['active']) continue;
            if (!isset($starts[$rule['key']])) { $starts[$rule['key']] = $maxId; $changed = true; continue; }
            foreach (array_reverse($auto->pending($rule, max(1, (int) $this->option('limit')), (int) $starts[$rule['key']])) as $post) {
                $j = $auto->judge($post, $rule);
                $target = $auto->decide($post, $rule, $j, true);
                $this->line(sprintf('#%d %s → %s (%s)%s', $post->id, $rule['name'] ?: $rule['key'], $j['answer'] ? 'evet' : 'hayır', $j['confidence'], $target ? ' eklendi #' . $target : ''));
            }
            // Geçmiş: kural eklenmeden önceki gönderiler, her çalışmada bir parti (yeni mesaj bildirimi olmadan, içerik kopyalanarak)
            if ($rule['backfill']) {
                foreach ($auto->pending($rule, max(0, (int) $this->option('backfill'))) as $post) {
                    $j = $auto->judge($post, $rule);
                    $target = $auto->decide($post, $rule, $j, true, true);
                    $this->line(sprintf('geçmiş #%d %s → %s (%s)%s', $post->id, $rule['name'] ?: $rule['key'], $j['answer'] ? 'evet' : 'hayır', $j['confidence'], $target ? ' eklendi #' . $target : ''));
                }
            }
        }
        if ($changed) $settings->set('framio-upload-exif.auto_collect_start', json_encode($starts));

        return 0;
    }
}
