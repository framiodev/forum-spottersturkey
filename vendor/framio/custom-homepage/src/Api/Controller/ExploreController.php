<?php

namespace Framio\CustomHomepage\Api\Controller;

use Framio\CustomHomepage\Support\Explore;
use Framio\CustomHomepage\Support\GalleryPosts;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Keşfet sayfası verisi.
 *
 * GET /framio/explore                         → tüm bölümler (ilk açılış)
 * GET /framio/explore?section=popular&period= → popüler sekmesi (week|month|year|all)
 * GET /framio/explore?section=recent&offset=&tag=&brand=&city=&year= → son eklenenler
 *
 * Mesajlar galerinin belge biçiminde (data/included/meta) döner; bölümler yalnızca
 * mesaj kimliklerini taşır, böylece aynı mesaj bir kez gönderilir.
 */
class ExploreController implements RequestHandlerInterface
{
    public function __construct(protected Explore $explore, protected GalleryPosts $gallery)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $q = $request->getQueryParams();
        $section = (string) Arr::get($q, 'section', 'all');
        $sections = [];
        $ids = [];

        $enabled = fn (string $key) => $this->explore->setting('show_' . $key, '1') === '1';

        if ($section === 'popular') {
            $period = $this->period((string) Arr::get($q, 'period', 'week'));
            $sections['popular'] = ['period' => $period, 'ids' => $this->explore->popularIds($period)];
        } elseif ($section === 'recent') {
            $filter = array_filter(Arr::only($q, ['tag', 'brand', 'model', 'company', 'city', 'year', 'plate']), 'is_string');
            $offset = max(0, (int) Arr::get($q, 'offset', 0));
            $sections['recent'] = ['offset' => $offset, 'ids' => $this->explore->recentIds($filter, $offset)];
        } else {
            if ($enabled('potd')) {
                $potd = $this->explore->potd();
                $sections['potd'] = $potd;
            }
            if ($enabled('popular')) {
                $period = $this->period((string) $this->explore->setting('popular_default', 'week'));
                $sections['popular'] = ['period' => $period, 'ids' => $this->explore->popularIds($period)];
            }
            if ($enabled('recent')) {
                $sections['recent'] = ['offset' => 0, 'ids' => $this->explore->recentIds([])];
                $sections['facets'] = $this->explore->facets();
            }
            if ($enabled('collections')) {
                $sections['collections'] = [
                    ['title' => 'En çok fotoğraflanan modeller', 'items' => $this->explore->collections('model', 0, 12)],
                    ($month = $this->explore->collections('company', 30, 12))
                        ? ['title' => 'Bu ay en çok çekilen firmalar', 'items' => $month]
                        : ['title' => 'En çok fotoğraflanan firmalar', 'items' => $this->explore->collections('company', 0, 12)],
                    ['title' => 'Yeni eklenen plakalar', 'items' => $this->explore->collections('plate', 0, 12, 'new')],
                ];
            }
            if ($enabled('photographers')) {
                $sections['photographers'] = $this->explore->photographers();
            }
            if ($enabled('equipment')) {
                $sections['equipment'] = $this->explore->equipment();
            }
        }

        foreach ($sections as $key => $sec) {
            if (isset($sec['ids'])) $ids = array_merge($ids, $sec['ids']);
            if ($key === 'potd' && !empty($sec['post_id'])) $ids[] = $sec['post_id'];
            if ($key === 'photographers') foreach ($sec as $p) $ids = array_merge($ids, $p['postIds']);
        }

        $doc = $this->gallery->toDocument($this->explore->postsInOrder(array_values(array_unique($ids))), $request, ['explore' => $sections]);

        return new JsonResponse($doc);
    }

    protected function period(string $p): string
    {
        return in_array($p, ['day', 'week', 'month', 'year', 'all'], true) ? $p : 'week';
    }
}
