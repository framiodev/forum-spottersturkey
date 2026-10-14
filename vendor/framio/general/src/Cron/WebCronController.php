<?php

namespace Framio\General\Cron;

use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Contracts\Container\Container;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;

/**
 * Dış tetikleme (web cron): paylaşımlı hostingte cron en az 15 dakikada bir çalışabildiği için zamanlanmış
 * içerik komutları dışarıdan (ör. cron-job.org) bu adres çağrılarak daha sık çalıştırılır.
 *
 *  GET /framio-cron/{anahtar}
 *
 * - Yalnızca admin panelindeki listede bulunan komutlar, aynı işlem içinde (ayrı süreç başlatmadan) çalışır.
 * - Anahtar yanlışsa 404 döner (adresin varlığı belli edilmez).
 * - Aynı anda tek çalışma (kilit) ve en kısa aralık sınırı vardır; sık çağrı sunucuyu yormaz.
 * - Kuyruk ve diğer zamanlanmış görevler sunucu cron'unda (schedule:run) kalır.
 */
class WebCronController implements RequestHandlerInterface
{
    private const LOCK = 'framio-general.web-cron.lock';
    private const LAST = 'framio-general.web-cron.last';

    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected Container $container,
        protected Cache $cache
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $token = (string) ($request->getAttribute('routeParameters')['token'] ?? '');
        $expected = (string) $this->settings->get('framio-general.web_cron_token');

        if (!$this->settings->get('framio-general.web_cron_enabled') || $expected === '' || !hash_equals($expected, $token)) {
            return new JsonResponse(['error' => 'Not Found'], 404);
        }

        // En kısa aralık (saniye): çok sık çağrılarda komutlar yeniden çalışmaz
        $minInterval = max(30, (int) ($this->settings->get('framio-general.web_cron_min_interval') ?: 120));
        $last = (int) $this->cache->get(self::LAST, 0);
        if (time() - $last < $minInterval) {
            return new JsonResponse(['status' => 'skipped', 'reason' => 'too_soon', 'next_in' => $minInterval - (time() - $last)]);
        }

        $lock = $this->cache->lock(self::LOCK, 300);
        if (!$lock->get()) {
            return new JsonResponse(['status' => 'skipped', 'reason' => 'running']);
        }

        @set_time_limit(120);
        @ignore_user_abort(true); // dış servis bağlantıyı erken kapatsa da komutlar tamamlanır
        $results = [];
        try {
            $this->cache->forever(self::LAST, time());
            $console = $this->console();

            foreach ($this->commands() as $name) {
                if (!$console->has($name)) {
                    $results[$name] = 'yok';
                    continue;
                }
                $out = new BufferedOutput();
                $start = microtime(true);
                try {
                    $code = $console->find($name)->run(new ArrayInput([]), $out);
                    $results[$name] = ['code' => $code, 'ms' => (int) ((microtime(true) - $start) * 1000)];
                } catch (\Throwable $e) {
                    $results[$name] = ['error' => $e->getMessage()];
                    resolve('log')->warning("[framio-general] Web cron komutu başarısız: {$name}: " . $e->getMessage());
                }
            }
        } finally {
            $lock->release();
        }

        return new JsonResponse(['status' => 'ok', 'ran' => $results], 200, ['Cache-Control' => 'no-store']);
    }

    /** @return string[] */
    private function commands(): array
    {
        $raw = (string) ($this->settings->get('framio-general.web_cron_commands')
            ?: "drafts:publish\nfof:polls:publish-scheduled\nframio:social-share:process");

        // Yalnızca komut adı biçimindeki girdiler (argüman/kabuk ifadesi kabul edilmez)
        return array_values(array_filter(array_map('trim', preg_split('/[\s,]+/', $raw)), fn ($c) => (bool) preg_match('/^[a-z0-9][a-z0-9:_-]*$/i', $c)));
    }

    private function console(): Application
    {
        $console = new Application('Flarum');
        $console->setAutoExit(false);

        foreach ($this->container->make('flarum.console.commands') as $command) {
            try {
                $instance = is_string($command) ? $this->container->make($command) : $command;
                if (method_exists($instance, 'setLaravel')) {
                    $instance->setLaravel($this->container);
                }
                $console->add($instance);
            } catch (\Throwable $e) {
                // Kurulamayan komut diğerlerini engellemez
            }
        }

        return $console;
    }
}
