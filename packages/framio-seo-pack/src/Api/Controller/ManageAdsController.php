<?php

namespace Framio\SeoPack\Api\Controller;

use Carbon\Carbon;
use Flarum\Http\RequestUtil;
use Framio\SeoPack\Database\SeoAd;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class ManageAdsController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $params = $request->getQueryParams();

        if ($request->getMethod() === 'GET') {
            // Forum: yalnızca yayındaki reklamlar, istatistiksiz
            if (Arr::get($params, 'for_forum')) {
                $ads = SeoAd::where('is_active', true)->get()->filter->isLive()->map->toForumArray()->values();

                return new JsonResponse(['data' => $ads]);
            }

            $actor->assertAdmin();
            $ads = SeoAd::orderBy('id', 'desc')->get()->map(fn ($ad) => $ad->toArray() + ['is_live' => $ad->isLive()]);

            return new JsonResponse(['data' => $ads]);
        }

        $body = (array) $request->getParsedBody();
        $action = Arr::get($body, 'action', 'save');
        $id = (int) Arr::get($body, 'id');

        // Gösterim / tıklama sayacı ziyaretçilerden gelir
        if ($action === 'track_impression' || $action === 'track_click') {
            if ($id) {
                SeoAd::where('id', $id)->increment($action === 'track_click' ? 'clicks_count' : 'impressions_count');
            }

            return new JsonResponse(['success' => true]);
        }

        $actor->assertAdmin();

        if ($action === 'delete') {
            SeoAd::where('id', $id)->delete();

            return new JsonResponse(['success' => true]);
        }

        if ($action === 'toggle') {
            $ad = SeoAd::findOrFail($id);
            $ad->is_active = !$ad->is_active;
            $ad->save();

            return new JsonResponse(['success' => true, 'is_active' => $ad->is_active]);
        }

        if ($action === 'reset_stats') {
            SeoAd::where('id', $id)->update(['impressions_count' => 0, 'clicks_count' => 0]);

            return new JsonResponse(['success' => true]);
        }

        $pick = fn ($key, array $allowed, $default) => in_array($v = Arr::get($body, $key, $default), $allowed, true) ? $v : $default;
        $date = fn ($key) => ($v = trim((string) Arr::get($body, $key))) !== '' ? Carbon::parse($v) : null;

        $data = [
            'name' => mb_substr(trim((string) Arr::get($body, 'name', 'Yeni Reklam')) ?: 'Yeni Reklam', 0, 100),
            'location' => $pick('location', SeoAd::LOCATIONS, 'header_bottom'),
            'page_scope' => $pick('page_scope', ['all', 'home', 'discussion', 'tag'], 'all'),
            'tag_slugs' => trim((string) Arr::get($body, 'tag_slugs', '')) ?: null,
            'type' => $pick('type', SeoAd::TYPES, 'adsense'),
            'format' => $pick('format', SeoAd::FORMATS, 'inline'),
            'code' => (string) Arr::get($body, 'code', ''),
            'adsense_slot' => preg_replace('/\D/', '', (string) Arr::get($body, 'adsense_slot', '')) ?: null,
            'adsense_format' => $pick('adsense_format', ['auto', 'horizontal', 'rectangle', 'vertical', 'fluid'], 'auto'),
            'banner_image_url' => trim((string) Arr::get($body, 'banner_image_url', '')) ?: null,
            'banner_target_url' => trim((string) Arr::get($body, 'banner_target_url', '')) ?: null,
            'post_interval' => max(1, (int) Arr::get($body, 'post_interval', 5)),
            'delay_seconds' => max(0, (int) Arr::get($body, 'delay_seconds', 8)),
            'frequency_hours' => max(0, (int) Arr::get($body, 'frequency_hours', 24)),
            'is_active' => (bool) Arr::get($body, 'is_active', true),
            'desktop_visible' => (bool) Arr::get($body, 'desktop_visible', true),
            'mobile_visible' => (bool) Arr::get($body, 'mobile_visible', true),
            'hide_for_members' => (bool) Arr::get($body, 'hide_for_members', false),
            'starts_at' => $date('starts_at'),
            'ends_at' => $date('ends_at'),
            'estimated_earnings' => (float) Arr::get($body, 'estimated_earnings', 0),
        ];

        // Açılır pencere ve yapışkan şerit sayfada tek konumda (floating) yaşar
        if ($data['format'] !== 'inline') {
            $data['location'] = 'floating';
        }

        $ad = $id ? SeoAd::findOrFail($id) : new SeoAd();
        $ad->fill($data)->save();

        return new JsonResponse(['success' => true, 'data' => $ad->fresh()]);
    }
}
