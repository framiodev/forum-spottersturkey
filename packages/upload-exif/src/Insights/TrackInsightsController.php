<?php

namespace Framio\UploadExif\Insights;

use Carbon\Carbon;
use Flarum\Http\RequestUtil;
use Illuminate\Database\ConnectionInterface;
use Laminas\Diactoros\Response\EmptyResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Ziyaretçi davranışı toplu olarak (sendBeacon) gelir. Yöneticilerin kendi gezintisi ve botlar sayılmaz.
 * IP adresi saklanmaz ve hiçbir dış servise gönderilmez: konum yalnızca sunucunun önündeki CDN'in
 * (Cloudflare) eklediği ülke/şehir başlıklarından okunur.
 */
class TrackInsightsController implements RequestHandlerInterface
{
    protected const TYPES = ['view', 'dwell', 'slide', 'lightbox', 'click'];

    public function __construct(protected ConnectionInterface $db)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if ($actor->isAdmin() || !$this->db->getSchemaBuilder()->hasTable('framio_post_insights')) return new EmptyResponse(204);

        $ua = strtolower($request->getHeaderLine('User-Agent'));
        if ($ua === '' || preg_match('/bot|crawl|spider|slurp|preview|headless/', $ua)) return new EmptyResponse(204);

        $body = (array) $request->getParsedBody();
        $visitor = substr(preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($body['v'] ?? '')) ?: 'anon', 0, 40);
        $device = ($body['d'] ?? '') === 'mobile' ? 'mobile' : 'desktop';
        $events = array_slice((array) ($body['e'] ?? []), 0, 80);
        if (!$events) return new EmptyResponse(204);

        [$country, $city] = $this->locate($request);
        $now = Carbon::now();
        $rows = [];
        foreach ($events as $e) {
            $type = (string) ($e['t'] ?? '');
            $postId = (int) ($e['p'] ?? 0);
            if (!$postId || !in_array($type, self::TYPES, true)) continue;
            $rows[] = [
                'post_id' => $postId,
                'image_id' => !empty($e['i']) ? (int) $e['i'] : null,
                'visitor' => $visitor,
                'user_id' => $actor->isGuest() ? null : $actor->id,
                'type' => $type,
                'label' => isset($e['l']) ? mb_substr(trim((string) $e['l']), 0, 160) : null,
                'value' => max(0, min(3600000, (int) ($e['n'] ?? 0))),
                'country' => $country,
                'city' => $city,
                'device' => $device,
                'created_at' => $now,
            ];
        }
        if ($rows) $this->db->table('framio_post_insights')->insert($rows);

        return new EmptyResponse(204);
    }

    /** Cloudflare: CF-IPCountry her zaman; CF-IPCity "Add visitor location headers" açıksa gelir */
    protected function locate(ServerRequestInterface $request): array
    {
        $country = strtoupper(trim($request->getHeaderLine('CF-IPCountry')));
        $city = trim($request->getHeaderLine('CF-IPCity'));
        if ($country === '' || $country === 'XX' || $country === 'T1') $country = null;
        elseif (class_exists(\Locale::class)) $country = \Locale::getDisplayRegion('-' . $country, 'tr') ?: $country;

        return [$country, $city !== '' ? mb_substr($city, 0, 80) : null];
    }
}
