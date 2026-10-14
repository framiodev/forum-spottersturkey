<?php

namespace Framio\SeoPack\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Framio\SeoPack\BotCache\BotPageCache;
use Framio\SeoPack\Console\BackfillIndexCommand;
use Framio\SeoPack\Support\SeoSettings;
use Illuminate\Contracts\Cache\Repository as Cache;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Dashboard "Sistem Sağlığı" paneli: bot önbelleği, zamanlanmış görevler, dizine ekleme ilerlemesi
 * ve site haritası adres sayıları. POST action=flush_bot_cache bot önbelleğini temizler.
 */
class SeoHealthController implements RequestHandlerInterface
{
    public function __construct(
        protected SeoSettings $seo,
        protected SettingsRepositoryInterface $settings,
        protected BotPageCache $botCache,
        protected Cache $cache
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        if ($request->getMethod() === 'POST') {
            $action = ((array) $request->getParsedBody())['action'] ?? '';
            if ($action === 'flush_bot_cache') {
                return new JsonResponse(['message' => $this->botCache->flush() . ' önbellek dosyası temizlendi.']);
            }

            return new JsonResponse(['error' => 'Geçersiz işlem.'], 400);
        }

        // Adres sayıları pahalıdır (tüm gönderiler taranır): 10 dk önbelleklenir
        $counts = $this->cache->remember('framio-seo.health.counts', 600, function () {
            $cmd = resolve(BackfillIndexCommand::class);
            $pages = $cmd->pageUrls();
            $discussions = count(array_filter($pages, fn ($u) => !preg_match('~/d/[^/]+/\d+$~', $u)));
            try {
                $hubs = count($cmd->hubUrls());
            } catch (\Throwable $e) {
                $hubs = 0;
            }

            return ['pages' => count($pages), 'discussions' => $discussions, 'posts' => count($pages) - $discussions, 'hubs' => $hubs];
        });

        $cronLast = (int) $this->cache->get('framio-general.web-cron.last', 0);
        $cursor = (int) $this->settings->get('framio-seo.backfill_cursor', 0);
        $bot = $this->botCache->stats();

        return new JsonResponse([
            'bot_cache' => [
                'enabled' => $this->botCache->enabled(),
                'files' => $bot['files'],
                'bytes' => $bot['bytes'],
                'ttl' => $this->botCache->ttl(),
            ],
            'web_cron' => [
                'enabled' => (bool) $this->settings->get('framio-general.web_cron_enabled'),
                'last_run' => $cronLast ?: null,
                'ago' => $cronLast ? time() - $cronLast : null,
            ],
            'indexing' => [
                'indexnow' => $this->seo->bool('enable_indexnow'),
                'indexing_api' => $this->seo->bool('enable_indexing_api'),
                'service_account' => file_exists(storage_path('service_account.json')),
                'backfill_cursor' => min($cursor, $counts['pages']),
                'backfill_total' => $counts['pages'],
            ],
            'sitemaps' => $counts + [
                'post_pages_enabled' => $this->seo->bool('enable_post_pages'),
                'legacy_redirects' => $this->seo->bool('enable_legacy_redirects'),
            ],
        ]);
    }
}
