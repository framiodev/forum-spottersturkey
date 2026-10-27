<?php

namespace Framio\SeoPack\Console;

use Flarum\Console\AbstractCommand;
use Flarum\Settings\SettingsRepositoryInterface;
use Framio\SeoPack\Support\EntityIndex;
use Framio\SeoPack\Support\SeoSettings;
use GuzzleHttp\Client;
use GuzzleHttp\Pool;
use GuzzleHttp\Psr7\Request;
use Illuminate\Contracts\Cache\Repository as Cache;
use Symfony\Component\Console\Input\InputOption;

/**
 * SEO bakım görevi (günlük zamanlanır):
 *  1) Künye ayrıştırma kuralları değiştiyse (EntityIndex::PARSER_VERSION) varlık dizinini kendiliğinden yeniler —
 *     eskiden kod güncellemesinden sonra "seo:index-entities" elle çalıştırılmalıydı.
 *  2) Haftada bir (ya da --audit ile hemen) site haritasındaki görselleri ve mesaj sayfalarını yoklar; 404/5xx ve
 *     yönlendirme verenleri kaydeder. Sonuç admin "Sistem Sağlığı" panelinde görünür.
 */
class MaintenanceCommand extends AbstractCommand
{
    public const AUDIT_KEY = 'framio-seo.health.audit';

    public function __construct(
        protected EntityIndex $index,
        protected SettingsRepositoryInterface $settings,
        protected SeoSettings $seo,
        protected Cache $cache
    ) {
        parent::__construct();
    }

    protected function configure()
    {
        $this->setName('seo:maintenance')
            ->setDescription('Künye dizini sürüm kontrolü ve haftalık görsel/sayfa erişilebilirlik denetimi.')
            ->addOption('audit', null, InputOption::VALUE_NONE, 'Görsel/sayfa denetimini beklemeden şimdi çalıştır');
    }

    protected function fire(): int
    {
        if ((string) $this->settings->get('framio-seo.entity_parser_version') !== (string) EntityIndex::PARSER_VERSION) {
            $this->info('Künye ayrıştırma kuralları değişmiş: varlık dizini yenileniyor…');
            $n = $this->index->rebuild();
            $this->settings->set('framio-seo.entity_parser_version', (string) EntityIndex::PARSER_VERSION);
            $this->info("Tamamlandı: {$n} mesaj.");
        }

        $last = (array) $this->cache->get(self::AUDIT_KEY, []);
        if ($this->option('audit') || empty($last['at']) || time() - (int) $last['at'] > 7 * 86400) {
            $this->audit();
        }

        return 0;
    }

    /** Görsel site haritasındaki görseller + mesaj sayfaları: yanıt kodu 200 olmayanlar kaydedilir */
    public function audit(): array
    {
        $base = $this->seo->baseUrl();
        $client = new Client(['timeout' => 25, 'connect_timeout' => 8, 'http_errors' => false, 'allow_redirects' => false]);
        $xml = (string) $client->get($base . '/sitemap-images.xml', ['timeout' => 120])->getBody();

        $items = [];
        if (preg_match_all('~<url><loc>(.*?)</loc>(.*?)</url>~s', $xml, $urls, PREG_SET_ORDER)) {
            foreach ($urls as $u) {
                $page = html_entity_decode($u[1], ENT_XML1 | ENT_QUOTES, 'UTF-8');
                $items[] = ['url' => $page, 'type' => 'page', 'page' => $page];
                preg_match_all('~<image:loc>(.*?)</image:loc>~', $u[2], $imgs);
                foreach ($imgs[1] as $img) {
                    $items[] = ['url' => html_entity_decode($img, ENT_XML1 | ENT_QUOTES, 'UTF-8'), 'type' => 'image', 'page' => $page];
                }
            }
        }

        $bad = [];
        $requests = function () use ($items) {
            foreach ($items as $i => $it) {
                yield $i => new Request('HEAD', $it['url'], ['User-Agent' => 'Mozilla/5.0 (compatible; FramioSeoAudit/1.0)']);
            }
        };
        (new Pool($client, $requests(), [
            'concurrency' => 8,
            'fulfilled' => function ($res, $i) use (&$bad, $items) {
                $code = $res->getStatusCode();
                if ($code !== 200) {
                    $bad[] = $items[$i] + ['code' => $code, 'location' => $res->getHeaderLine('Location') ?: null];
                }
            },
            'rejected' => function ($e, $i) use (&$bad, $items) {
                $bad[] = $items[$i] + ['code' => 0, 'location' => null];
            },
        ]))->promise()->wait();

        $result = [
            'at' => time(),
            'checked_images' => count(array_filter($items, fn ($x) => $x['type'] === 'image')),
            'checked_pages' => count(array_filter($items, fn ($x) => $x['type'] === 'page')),
            'bad' => array_slice($bad, 0, 200),
            'bad_count' => count($bad),
        ];
        $this->cache->forever(self::AUDIT_KEY, $result);
        $this->info("Denetim: {$result['checked_images']} görsel, {$result['checked_pages']} sayfa; sorunlu: {$result['bad_count']}");

        return $result;
    }
}
