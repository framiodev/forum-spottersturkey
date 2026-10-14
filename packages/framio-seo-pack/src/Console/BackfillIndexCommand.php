<?php

namespace Framio\SeoPack\Console;

use Flarum\Console\AbstractCommand;
use Flarum\Discussion\Discussion;
use Flarum\Settings\SettingsRepositoryInterface;
use Framio\SeoPack\HubSitemapController;
use Framio\SeoPack\Support\PostPages;
use Framio\SeoPack\Support\SeoSettings;
use Google\Client;
use Google\Service\Indexing;
use Google\Service\Indexing\UrlNotification;
use GuzzleHttp\Client as Http;
use Laminas\Diactoros\ServerRequest;
use Symfony\Component\Console\Input\InputOption;

/**
 * Var olan (eski) içerikleri arama motorlarına geriye dönük bildirir.
 *
 *  --google      Konu ve gönderi adreslerini Google Indexing API'ye bildirir. Kaldığı yerden devam eder
 *                (framio-seo.backfill_cursor); her çalışmada en fazla --limit adres (Google'ın günlük kotası 200).
 *  --indexnow    Konu, gönderi ve araç (hub) adreslerinin tamamını IndexNow'a (Bing, Yandex, Seznam, Naver) gönderir.
 *  --reset       Google imlecini başa alır.
 *  --dry-run     Hiçbir şey göndermeden sayıları gösterir.
 */
class BackfillIndexCommand extends AbstractCommand
{
    private const CURSOR = 'framio-seo.backfill_cursor';

    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected SeoSettings $seo,
        protected PostPages $posts
    ) {
        parent::__construct();
    }

    protected function configure()
    {
        $this->setName('seo:backfill-index')
            ->setDescription('Eski konu/gönderi/araç sayfalarını Google Indexing API ve IndexNow\'a geriye dönük bildirir.')
            ->addOption('google', null, InputOption::VALUE_NONE, 'Google Indexing API (kaldığı yerden, kota sınırlı)')
            ->addOption('indexnow', null, InputOption::VALUE_NONE, 'IndexNow toplu bildirim (tümü)')
            ->addOption('limit', null, InputOption::VALUE_REQUIRED, 'Google için bu çalışmadaki en fazla adres', '180')
            ->addOption('reset', null, InputOption::VALUE_NONE, 'Google imlecini başa al')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Göndermeden say');
    }

    protected function fire(): int
    {
        $pages = $this->pageUrls();
        $dry = (bool) $this->input->getOption('dry-run');
        $this->info(count($pages) . ' konu/gönderi adresi bulundu.');

        if ($this->input->getOption('reset')) {
            $this->settings->set(self::CURSOR, 0);
        }

        if ($this->input->getOption('google')) {
            $this->google($pages, max(1, (int) $this->input->getOption('limit')), $dry);
        }

        if ($this->input->getOption('indexnow')) {
            $this->indexNow(array_values(array_unique(array_merge($pages, $this->hubUrls()))), $dry);
        }

        if (!$this->input->getOption('google') && !$this->input->getOption('indexnow')) {
            $this->info('Bir hedef seçin: --google ve/veya --indexnow');
        }

        return 0;
    }

    /** Önce konular (en çok güncellenenler önce), ardından gönderi sayfaları (eskiden yeniye) */
    public function pageUrls(): array
    {
        $urls = [];
        Discussion::query()
            ->where('is_private', false)->whereNull('hidden_at')
            ->orderByDesc('last_posted_at')
            ->get(['id', 'slug', 'title', 'last_posted_at'])
            ->each(function ($d) use (&$urls) {
                $urls[] = $this->seo->discussionUrl($d);
            });

        if ($this->posts->enabled()) {
            $this->posts->query()
                ->with('discussion:id,slug,title,is_private,hidden_at')
                ->select('posts.*')
                ->orderBy('posts.id')
                ->chunk(500, function ($chunk) use (&$urls) {
                    foreach ($chunk as $post) {
                        if ($post->discussion && $this->posts->qualifies($post)) {
                            $urls[] = $this->posts->url($post);
                        }
                    }
                });
        }

        return array_values(array_unique($urls));
    }

    public function hubUrls(): array
    {
        try {
            $xml = (string) resolve(HubSitemapController::class)->handle(new ServerRequest())->getBody();
            preg_match_all('~<loc>([^<]+)</loc>~', $xml, $m);

            return array_map(fn ($u) => html_entity_decode($u, ENT_XML1, 'UTF-8'), $m[1]);
        } catch (\Throwable $e) {
            $this->info('Araç sayfaları alınamadı: ' . $e->getMessage());

            return [];
        }
    }

    private function google(array $urls, int $limit, bool $dry): void
    {
        $keyFile = storage_path('service_account.json');
        if (!file_exists($keyFile)) {
            $this->error('service_account.json bulunamadı; Google atlandı.');
            return;
        }

        $cursor = (int) $this->settings->get(self::CURSOR, 0);
        $batch = array_slice($urls, $cursor, $limit);
        if (!$batch) {
            $this->info('Google: bütün adresler bildirildi (' . count($urls) . ').');
            return;
        }
        if ($dry) {
            $this->info("Google: {$cursor}. adresten itibaren " . count($batch) . ' adres gönderilecekti.');
            return;
        }

        $client = new Client();
        $client->setAuthConfig($keyFile);
        $client->addScope('https://www.googleapis.com/auth/indexing');
        $service = new Indexing($client);

        $sent = 0;
        foreach ($batch as $url) {
            try {
                $n = new UrlNotification();
                $n->setUrl($url);
                $n->setType('URL_UPDATED');
                $service->urlNotifications->publish($n);
                $sent++;
            } catch (\Google\Service\Exception $e) {
                if ($e->getCode() === 429) {
                    $this->info('Google günlük kotası doldu; yarın kaldığı yerden devam edecek.');
                    break;
                }
                // Tek adresin hatası sırayı durdurmaz
                $sent++;
            }
        }

        $this->settings->set(self::CURSOR, $cursor + $sent);
        $this->info("Google: {$sent} adres bildirildi. İlerleme: " . min(count($urls), $cursor + $sent) . ' / ' . count($urls));
    }

    private function indexNow(array $urls, bool $dry): void
    {
        $key = $this->settings->get('framio-seo.indexnow_key');
        if (!$key) {
            $this->error('IndexNow anahtarı yok; önce admin panelinden IndexNow\'u açın.');
            return;
        }
        if ($dry) {
            $this->info('IndexNow: ' . count($urls) . ' adres gönderilecekti.');
            return;
        }

        $base = rtrim($this->seo->baseUrl(), '/');
        $host = parse_url($base, PHP_URL_HOST);
        $http = new Http(['timeout' => 30]);

        foreach (array_chunk($urls, 10000) as $i => $chunk) {
            try {
                $res = $http->post('https://api.indexnow.org/indexnow', [
                    'json' => ['host' => $host, 'key' => $key, 'keyLocation' => $base . '/' . $key . '.txt', 'urlList' => $chunk],
                    'http_errors' => false,
                ]);
                $this->info('IndexNow parti ' . ($i + 1) . ': ' . count($chunk) . ' adres → HTTP ' . $res->getStatusCode());
            } catch (\Throwable $e) {
                $this->error('IndexNow hatası: ' . $e->getMessage());
            }
        }
    }
}
