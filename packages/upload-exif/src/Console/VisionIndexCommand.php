<?php

namespace Framio\UploadExif\Console;

use Carbon\Carbon;
use Flarum\Console\AbstractCommand;
use Flarum\Settings\SettingsRepositoryInterface;
use Framio\UploadExif\Ai\VisionSimilarity;
use GuzzleHttp\Client;
use GuzzleHttp\Promise\Utils;
use Illuminate\Database\ConnectionInterface;
use Symfony\Component\Console\Input\InputOption;

/**
 * Görsel benzerlik dizinini doldurur: künyeli fotoğrafların görsel gömmelerini hesaplar.
 * İlk çalıştırmada tüm geçmişi, sonra yalnızca yeni fotoğrafları işler (cron ile çalıştırılabilir).
 */
class VisionIndexCommand extends AbstractCommand
{
    public function __construct(
        protected ConnectionInterface $db,
        protected SettingsRepositoryInterface $settings,
        protected VisionSimilarity $similarity
    ) {
        parent::__construct();
    }

    protected function configure()
    {
        $this->setName('media:vision-index')
            ->setDescription('Framio AI görsel benzerlik dizinini günceller (yeni künyeli fotoğraflar).')
            ->addOption('limit', null, InputOption::VALUE_REQUIRED, 'En fazla kaç fotoğraf işlensin', 500)
            ->addOption('retry', null, InputOption::VALUE_NONE, 'Daha önce hata alanları yeniden dene');
    }

    protected function fire(): int
    {
        if (!$this->similarity->available()) {
            $this->info('Görsel benzerlik kapalı ya da Framio AI sağlayıcılarında Gemini anahtarı yok.');

            return 0;
        }

        if ($this->input->getOption('retry')) {
            $this->db->table(VisionSimilarity::TABLE)->whereNull('vec')->delete();
        }

        $q = $this->db->table('framio_seo_entities as e')
            ->whereNotNull('e.image_url')->where('e.image_url', '!=', '')
            ->whereNotExists(fn ($s) => $s->from(VisionSimilarity::TABLE . ' as v')->whereColumn('v.image_url', 'e.image_url'))
            ->groupBy('e.image_url')
            // Ham SQL'de tablo öneki (ör. "arsv") kendiliğinden eklenmez: takma ad grammar ile sarılır
            ->select('e.image_url')
            ->selectRaw('MAX(' . $this->db->getQueryGrammar()->wrap('e.post_id') . ') as post_id')
            ->orderByDesc('post_id');

        // Admin'in seçtiği bölümlerle sınırla
        $tags = array_filter(array_map('trim', explode(',', (string) $this->settings->get('framio-upload-exif.ai_history_tags', ''))));
        if ($tags) {
            $tagIds = $this->db->table('tags')->whereIn('slug', $tags)->pluck('id')->all();
            $tagIds = array_merge($tagIds, $this->db->table('tags')->whereIn('parent_id', $tagIds ?: [0])->pluck('id')->all());
            $q->whereIn('e.discussion_id', fn ($s) => $s->from('discussion_tag')->select('discussion_id')->whereIn('tag_id', $tagIds ?: [0]));
        }

        $rows = $q->limit((int) $this->input->getOption('limit'))->get();
        $this->info(count($rows) . ' fotoğraf işlenecek...');

        $client = new Client(['timeout' => 20, 'connect_timeout' => 5, 'headers' => ['User-Agent' => 'Mozilla/5.0 (Framio vision index)']]);
        $ok = 0;
        $fail = 0;

        foreach ($rows->chunk(4) as $chunk) {
            $promises = [];
            foreach ($chunk as $row) {
                $promises[$row->image_url] = $client->getAsync($row->image_url)
                    ->then(fn ($res) => $this->similarity->embedAsync($client, (string) $res->getBody()));
            }
            $results = Utils::settle($promises)->wait();

            foreach ($chunk as $row) {
                $r = $results[$row->image_url];
                $fulfilled = $r['state'] === 'fulfilled';
                $error = $fulfilled ? null : mb_substr($r['reason'] instanceof \Throwable ? $r['reason']->getMessage() : 'hata', 0, 190);

                // Kota aşımı: kaydetmeden dur, sonraki çalıştırmada devam edilir
                if (!$fulfilled && str_contains((string) $error, '429')) {
                    $this->info("Gemini kota sınırı; $ok fotoğraf işlendi, kalanlar sonraki çalıştırmada.");

                    return 0;
                }

                $this->db->table(VisionSimilarity::TABLE)->insertOrIgnore([
                    'post_id' => $row->post_id,
                    'image_hash' => sha1($row->image_url),
                    'image_url' => mb_substr($row->image_url, 0, 500),
                    'vec' => $fulfilled ? $this->similarity->pack($r['value']) : null,
                    'model' => VisionSimilarity::MODEL,
                    'error' => $error,
                    'created_at' => Carbon::now(),
                ]);
                $fulfilled ? $ok++ : $fail++;
            }
            $this->output->write("\r$ok tamam, $fail hata");
        }

        $this->info("\nBitti: $ok fotoğraf dizine eklendi, $fail hata.");

        return 0;
    }
}
