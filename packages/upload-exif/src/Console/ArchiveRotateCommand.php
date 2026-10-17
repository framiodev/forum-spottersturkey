<?php

namespace Framio\UploadExif\Console;

use Carbon\Carbon;
use Flarum\Console\AbstractCommand;
use Flarum\User\User;
use Framio\UploadExif\Assistant\Era;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Database\ConnectionInterface;
use Symfony\Component\Console\Input\InputOption;

/**
 * Yıl dönümü: Güncel başlıklardaki, çekim yılı artık Güncel sayılmayan (bu yıl ve geçen yıldan
 * eski) fotoğraflı mesajları aynı adlı Arşiv başlığına taşır. Çekim yılı künyedeki yıldan okunur.
 *
 * Varsayılan olarak yalnızca ne yapılacağını listeler; --apply ile taşır. Yılda bir (ör. 1 Ocak)
 * cron ile çalıştırılabilir. Taşıma, moderasyondaki "mesaj taşıma" işleviyle yapılır
 * (sıra numaraları, sayaçlar ve son mesaj bilgisi doğru güncellenir).
 */
class ArchiveRotateCommand extends AbstractCommand
{
    public function __construct(protected ConnectionInterface $db, protected Era $era, protected Dispatcher $bus)
    {
        parent::__construct();
    }

    protected function configure()
    {
        $this->setName('media:archive-rotate')
            ->setDescription('Çekim yılı eskiyen fotoğrafları Güncel başlıklardan aynı adlı Arşiv başlıklarına taşır.')
            ->addOption('apply', null, InputOption::VALUE_NONE, 'Gerçekten taşı (yoksa yalnızca listeler)')
            ->addOption('limit', null, InputOption::VALUE_REQUIRED, 'En fazla kaç mesaj', 2000);
    }

    protected function fire(): int
    {
        if (!$this->era->enabled()) {
            $this->info('Bu sitede Güncel/Arşiv üst etiketleri yok; yapılacak bir şey yok.');

            return 0;
        }
        if (!class_exists(\FoF\MovePosts\Command\MovePosts::class)) {
            $this->error('Mesaj taşıma modülü (moderation → move-posts) etkin değil.');

            return 1;
        }

        $minYear = ((int) Carbon::now()->format('Y')) - 1;
        $apply = (bool) $this->input->getOption('apply');
        $admin = User::query()->whereHas('groups', fn ($q) => $q->where('id', 1))->orderBy('id')->first();

        // Künyesindeki çekim yılı eşikten eski olan mesajlar
        $rows = $this->db->table('framio_seo_entities')->where('type', 'year')->where('name', '<', (string) $minYear)
            ->select('post_id', 'discussion_id', 'name')->distinct()->limit((int) $this->input->getOption('limit'))->get();

        $plan = [];
        foreach ($rows as $r) {
            if ($this->era->ofDiscussion((int) $r->discussion_id) !== Era::CURRENT) continue;
            $target = $this->era->mirror((int) $r->discussion_id, Era::ARCHIVE);
            if (!$target) {
                $this->info("Başlık #{$r->discussion_id}: Arşiv karşılığı yok, mesaj #{$r->post_id} atlandı.");
                continue;
            }
            $plan[$r->discussion_id . '>' . $target][] = (int) $r->post_id;
        }

        if (!$plan) {
            $this->info("Taşınacak mesaj yok ($minYear öncesi çekimler zaten Arşiv'de).");

            return 0;
        }

        $moved = 0;
        foreach ($plan as $pair => $postIds) {
            [$from, $to] = array_map('intval', explode('>', $pair));
            $title = $this->db->table('discussions')->where('id', $from)->value('title');
            $this->info(($apply ? 'Taşınıyor' : 'Taşınacak') . ": \"$title\" #$from → #$to · " . count($postIds) . ' mesaj');
            if (!$apply) continue;

            // Taşıma modülü mesajları tarih sırasıyla tek seferde taşır; eski mesaj daha yeni bir başlığa
            // taşınamıyorsa (modül kuralı) o grup atlanır ve bildirilir
            try {
                $this->bus->dispatch(new \FoF\MovePosts\Command\MovePosts($admin, [
                    'sourceDiscussionId' => $from,
                    'targetDiscussionId' => $to,
                    'postIds' => $postIds,
                ], false));
                $moved += count($postIds);
            } catch (\Throwable $e) {
                $this->error("  atlandı: " . $e->getMessage());
            }
        }

        $this->info($apply ? "Bitti: $moved mesaj Arşiv'e taşındı." : 'Yalnızca listelendi; taşımak için --apply ekleyin.');

        return 0;
    }
}
