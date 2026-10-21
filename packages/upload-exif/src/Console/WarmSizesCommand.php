<?php

namespace Framio\UploadExif\Console;

use Carbon\Carbon;
use Flarum\Settings\SettingsRepositoryInterface;
use GuzzleHttp\Client;
use GuzzleHttp\Pool;
use GuzzleHttp\Psr7\Request;
use Illuminate\Console\Command;
use Illuminate\Database\ConnectionInterface;

/**
 * Görsel sunucusu (?w=) boyutlarını ziyaretçiden ÖNCE üretir: yeni yüklenen görsellerin ana sayfa (480),
 * küçük (250) ve mesaj (1024) boyutları istenir; görsel sunucusu bunları saklar ve CDN'e alır.
 * Böylece ilk ziyaretçi 3-4 sn beklemez. Zamanlayıcı her 10 dakikada son 2 saati ısıtır;
 * --all ile tüm arşiv bir kez ısıtılır.
 */
class WarmSizesCommand extends Command
{
    protected $signature = 'media:warm-sizes {--all : Tüm görseller} {--hours=2 : Son kaç saat} {--widths=250,480,1024 : Genişlikler}';
    protected $description = 'Görsel sunucusundaki küçültülmüş boyutları önceden üretir (ilk açılış gecikmesini kaldırır)';

    public function handle(ConnectionInterface $db, SettingsRepositoryInterface $settings): int
    {
        if (!$settings->get('framio-upload-exif.cdn_dynamic_resize')) {
            $this->info('Görsel sunucusu boyutlandırması (cdn_dynamic_resize) kapalı; yapılacak iş yok.');
            return 0;
        }
        $widths = array_filter(array_map('intval', explode(',', (string) $this->option('widths'))));
        $q = $db->table('framio_media_images')->whereNotNull('path')->orderByDesc('id');
        if (!$this->option('all')) $q->where('created_at', '>=', Carbon::now()->subHours(max(1, (int) $this->option('hours'))));

        $client = new Client(['timeout' => 60, 'connect_timeout' => 10, 'http_errors' => false]);
        $total = 0;
        $q->select('id', 'path')->chunkById(200, function ($rows) use ($client, $widths, &$total) {
            $reqs = function () use ($rows, $widths) {
                foreach ($rows as $r) {
                    $base = preg_replace('/\?.*$/', '', $r->path);
                    foreach ($widths as $w) yield new Request('GET', $base . '?w=' . $w);
                }
            };
            (new Pool($client, $reqs(), ['concurrency' => 4]))->promise()->wait();
            $total += count($rows);
            $this->info("Isıtılan görsel: {$total}");
        }, 'id');

        return 0;
    }
}
