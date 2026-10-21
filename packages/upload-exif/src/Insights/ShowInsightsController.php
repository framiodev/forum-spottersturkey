<?php

namespace Framio\UploadExif\Insights;

use Carbon\Carbon;
use Flarum\Http\RequestUtil;
use Illuminate\Database\ConnectionInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/** Yönetici: tek gönderinin istatistik özeti */
class ShowInsightsController implements RequestHandlerInterface
{
    public function __construct(protected ConnectionInterface $db)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();
        $postId = (int) ($request->getQueryParams()['id'] ?? 0);
        if (!$postId || !$this->db->getSchemaBuilder()->hasTable('framio_post_insights')) return new JsonResponse(['unique' => 0]);

        $q = fn () => $this->db->table('framio_post_insights')->where('post_id', $postId);
        $uniq = $q()->where('type', 'view')->distinct()->count('visitor');
        $members = $q()->where('type', 'view')->whereNotNull('user_id')->distinct()->count('visitor');

        // İnceleme süresi: ziyaretçi başına toplam
        $dwellPer = $q()->where('type', 'dwell')->groupBy('visitor')->selectRaw('visitor, SUM(value) as ms')->pluck('ms')
            ->map(fn ($v) => (int) $v)->sort()->values();
        $dwellTotal = (int) $dwellPer->sum();
        $buckets = ['0–3 sn' => 0, '3–10 sn' => 0, '10–30 sn' => 0, '30 sn–1 dk' => 0, '1 dk+' => 0];
        foreach ($dwellPer as $ms) {
            $s = $ms / 1000;
            $buckets[$s < 3 ? '0–3 sn' : ($s < 10 ? '3–10 sn' : ($s < 30 ? '10–30 sn' : ($s < 60 ? '30 sn–1 dk' : '1 dk+')))]++;
        }

        // Fotoğraf başına süre ve inceleyen kişi
        $images = $q()->where('type', 'dwell')->whereNotNull('image_id')->groupBy('image_id')
            ->selectRaw('image_id, SUM(value) as ms, COUNT(DISTINCT visitor) as people')->get()
            ->map(fn ($r) => ['id' => (int) $r->image_id, 'ms' => (int) $r->ms, 'people' => (int) $r->people])->all();

        // Kaydırma: ziyaretçinin ulaştığı en ileri fotoğraf ve geri dönüşler
        $reach = $q()->where('type', 'slide')->groupBy('visitor')->selectRaw('visitor, MAX(value) as maxi')->pluck('maxi');
        $reachDist = [];
        foreach ($reach as $r) $reachDist[(int) $r + 1] = ($reachDist[(int) $r + 1] ?? 0) + 1;
        ksort($reachDist);

        $lb = $q()->where('type', 'lightbox')->selectRaw('COUNT(*) as opens, COUNT(DISTINCT visitor) as people, COALESCE(SUM(value),0) as ms')->first();

        $clicks = $q()->where('type', 'click')->groupBy('label')->selectRaw('label, COUNT(*) as n, COUNT(DISTINCT visitor) as people')
            ->orderByDesc('n')->limit(15)->get()->map(fn ($r) => ['label' => $r->label, 'n' => (int) $r->n, 'people' => (int) $r->people])->all();

        $loc = $q()->where('type', 'view')->groupBy('country', 'city')->selectRaw('country, city, COUNT(DISTINCT visitor) as n')
            ->orderByDesc('n')->limit(12)->get()->map(fn ($r) => ['country' => $r->country, 'city' => $r->city, 'n' => (int) $r->n])->all();

        $devices = $q()->where('type', 'view')->groupBy('device')->selectRaw('device, COUNT(DISTINCT visitor) as n')->pluck('n', 'device')
            ->map(fn ($v) => (int) $v)->all();

        $since = Carbon::now()->subDays(13)->startOfDay();
        $daily = $q()->where('type', 'view')->where('created_at', '>=', $since)->selectRaw('DATE(created_at) as d, COUNT(DISTINCT visitor) as n')
            ->groupBy('d')->pluck('n', 'd')->all();
        $days = [];
        for ($i = 0; $i < 14; $i++) {
            $d = $since->copy()->addDays($i)->toDateString();
            $days[] = ['d' => $d, 'n' => (int) ($daily[$d] ?? 0)];
        }

        return new JsonResponse([
            'unique' => $uniq, 'views' => $q()->where('type', 'view')->count(), 'members' => $members, 'guests' => max(0, $uniq - $members),
            'dwellTotal' => $dwellTotal,
            'dwellAvg' => $dwellPer->count() ? (int) ($dwellTotal / $dwellPer->count()) : 0,
            'dwellMedian' => $dwellPer->count() ? $dwellPer[intdiv($dwellPer->count(), 2)] : 0,
            'dwellBuckets' => $buckets, 'images' => $images,
            'swipers' => $reach->count(), 'slides' => $q()->where('type', 'slide')->count(),
            'backs' => $q()->where('type', 'slide')->where('label', 'back')->count(), 'reach' => $reachDist,
            'lightbox' => ['opens' => (int) $lb->opens, 'people' => (int) $lb->people, 'ms' => (int) $lb->ms],
            'clicks' => $clicks, 'locations' => $loc, 'devices' => $devices, 'daily' => $days,
            'since' => $q()->min('created_at'),
        ]);
    }
}
