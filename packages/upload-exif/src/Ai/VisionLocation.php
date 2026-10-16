<?php

namespace Framio\UploadExif\Ai;

use Carbon\Carbon;
use Flarum\Settings\SettingsRepositoryInterface;
use GuzzleHttp\Client;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Promise\PromiseInterface;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;

/**
 * Çekim yeri tespiti. Kaynaklar güvenilirlik sırasıyla:
 *   1. Fotoğrafın GPS koordinatı (EXIF) → ters adres (OpenStreetMap Nominatim)
 *   2. Aynı kullanıcının aynı çekim oturumu (±4 saat) künyelerindeki yer
 *   3. Arka planı benzeyen geçmiş fotoğrafın yeri (görsel benzerlik)
 *   4. Yapay zekanın tahmini (yalnızca yüksek/orta güven)
 *
 * Biçim: varsayılan yalnızca il ("Ankara"); admin'in seçtiği bölümlerde (şehir içi)
 * "Yer - İl" ("Kızılay - Ankara").
 */
class VisionLocation
{
    public function __construct(
        protected ConnectionInterface $db,
        protected SettingsRepositoryInterface $settings,
        protected Cache $cache
    ) {
    }

    /** Bu konu yer + il biçimini mi kullanıyor? */
    public function detailed(?int $discussionId, ?string $tagSlug): bool
    {
        $allowed = array_filter(array_map('trim', explode(',', (string) $this->settings->get('framio-upload-exif.ai_location_detail_tags', ''))));
        if (!$allowed) return false;

        $slugs = $tagSlug ? [$tagSlug] : [];
        if ($discussionId) {
            $slugs = array_merge($slugs, $this->db->table('discussion_tag')->join('tags', 'tags.id', '=', 'discussion_tag.tag_id')
                ->where('discussion_tag.discussion_id', $discussionId)->pluck('tags.slug')->all());
        }
        if ($slugs) {
            $slugs = array_merge($slugs, $this->db->table('tags as t')->join('tags as p', 'p.id', '=', 't.parent_id')->whereIn('t.slug', $slugs)->pluck('p.slug')->all());
        }

        return (bool) array_intersect($allowed, $slugs);
    }

    public function format(?string $city, ?string $place, bool $detailed): string
    {
        $city = trim((string) $city);
        $place = trim((string) $place);
        if (!$detailed) return $city;
        if ($place !== '' && $city !== '' && mb_stripos($place, $city) === false) return $place . ' - ' . $city;

        return $place !== '' ? $place : $city;
    }

    /** @return array{lat:?float, lon:?float, date:?Carbon} */
    public function readExif(?string $head): array
    {
        $out = ['lat' => null, 'lon' => null, 'date' => null];
        if (!$head || !function_exists('exif_read_data')) return $out;

        $tmp = tempnam(sys_get_temp_dir(), 'fxif');
        file_put_contents($tmp, $head);
        $exif = @exif_read_data($tmp, 'GPS,EXIF', false);
        @unlink($tmp);
        if (!$exif) return $out;

        $deg = function ($parts, $ref) {
            if (!is_array($parts) || count($parts) < 3) return null;
            $f = function ($v) {
                $p = explode('/', (string) $v);

                return count($p) === 2 && (float) $p[1] ? (float) $p[0] / (float) $p[1] : (float) $p[0];
            };
            $d = $f($parts[0]) + $f($parts[1]) / 60 + $f($parts[2]) / 3600;

            return in_array($ref, ['S', 'W'], true) ? -$d : $d;
        };
        $lat = $deg($exif['GPSLatitude'] ?? null, $exif['GPSLatitudeRef'] ?? 'N');
        $lon = $deg($exif['GPSLongitude'] ?? null, $exif['GPSLongitudeRef'] ?? 'E');
        if ($lat && $lon && abs($lat) <= 90 && abs($lon) <= 180) {
            $out['lat'] = $lat;
            $out['lon'] = $lon;
        }
        $date = $exif['DateTimeOriginal'] ?? $exif['DateTime'] ?? null;
        if ($date) {
            try {
                $out['date'] = Carbon::createFromFormat('Y:m:d H:i:s', trim($date));
            } catch (\Throwable $e) {
            }
        }

        return $out;
    }

    /**
     * Koordinattan il ve yer (otogar, tesis, semt). Sonuç kalıcı önbellekte (yaklaşık 100 m'lik ızgara).
     *
     * @return PromiseInterface<array{city:string, place:string}|null>
     */
    public function reverseAsync(Client $client, float $lat, float $lon): PromiseInterface
    {
        $key = 'framio_geo_' . round($lat, 3) . '_' . round($lon, 3);
        if (($hit = $this->cache->get($key)) !== null) {
            return Create::promiseFor($hit ?: null);
        }

        return $client->getAsync('https://nominatim.openstreetmap.org/reverse', [
            'query' => ['format' => 'jsonv2', 'lat' => $lat, 'lon' => $lon, 'zoom' => 17, 'accept-language' => 'tr', 'addressdetails' => 1],
            'headers' => ['User-Agent' => 'FramioMedia/1.0 (' . ($this->settings->get('forum_title') ?: 'Flarum') . ')'],
            'timeout' => 4,
        ])->then(function ($res) use ($key) {
            $j = json_decode((string) $res->getBody(), true) ?: [];
            $a = $j['address'] ?? [];
            $city = $a['province'] ?? $a['state'] ?? $a['city'] ?? '';
            $city = preg_replace('/\s+(İli|ili|Province)$/u', '', (string) $city);
            // Otogar / tesis gibi adlandırılmış yerler önce, yoksa semt / ilçe
            $named = in_array($j['category'] ?? '', ['amenity', 'tourism', 'aeroway', 'railway', 'public_transport'], true) ? ($j['name'] ?? '') : '';
            $place = $named ?: ($a['suburb'] ?? $a['neighbourhood'] ?? $a['quarter'] ?? $a['town'] ?? $a['city_district'] ?? $a['district'] ?? '');
            $out = $city ? ['city' => $city, 'place' => (string) $place] : null;
            $this->cache->forever($key, $out ?: []);

            return $out;
        }, fn () => null);
    }

    /**
     * Aynı kullanıcının aynı çekim oturumundaki (±4 saat) künyelerden yer.
     *
     * @return array{city:string, place:string}|null
     */
    public function fromSession(int $userId, ?Carbon $shotAt): ?array
    {
        if (!$this->db->getSchemaBuilder()->hasTable('framio_seo_entities')) return null;

        $postIds = [];
        if ($shotAt) {
            // Çekim zamanı bilinen görseller: EXIF tarihi yakın olanların yolları
            $paths = [];
            foreach ($this->db->table('framio_media_images')->where('user_id', $userId)->whereNotNull('exif_data')->orderByDesc('id')->limit(400)->get(['path', 'thumb_path', 'exif_data']) as $img) {
                $d = json_decode((string) $img->exif_data, true)['date'] ?? null;
                if (!$d) continue;
                try {
                    $t = Carbon::createFromFormat('Y:m:d H:i:s', $d);
                } catch (\Throwable $e) {
                    continue;
                }
                if (abs($t->diffInMinutes($shotAt, false)) <= 240) {
                    $paths[] = $img->path;
                    if ($img->thumb_path) $paths[] = $img->thumb_path;
                }
            }
            if ($paths) {
                $postIds = $this->db->table('framio_seo_entities')->whereIn('image_url', $paths)->distinct()->pluck('post_id')->all();
            }
        }
        // Çekim zamanı bilinmiyorsa oturum eşleştirmesi yapılmaz (aynı gün farklı yerlerde çekim olabilir)
        if (!$postIds) return null;

        return $this->entitiesLocation($postIds);
    }

    /** Verilen mesajların künyelerinde en sık geçen il ve yer */
    public function entitiesLocation(array $postIds, ?string $imageUrl = null): ?array
    {
        $q = fn ($type) => $this->db->table('framio_seo_entities')->where('type', $type)->whereIn('post_id', $postIds)
            ->when($imageUrl, fn ($w) => $w->where(fn ($x) => $x->where('image_url', $imageUrl)->orWhereNull('image_url')))
            ->groupBy('name')->selectRaw('name, COUNT(*) as n')->orderByDesc('n')->value('name');
        $city = $q('city');
        if (!$city) return null;

        return ['city' => $city, 'place' => (string) $q('place')];
    }

    /** İstemde kullanılacak, forumda geçen çekim yerleri */
    public function knownPlaces(int $limit = 60): array
    {
        if (!$this->db->getSchemaBuilder()->hasTable('framio_seo_entities')) return [];

        // Forumda onaylanmış çekim yerleri, yer ile ili birlikte ("Küçükkuyu - Çanakkale").
        // Her yeni künyeyle liste kendiliğinden büyür; yapay zeka aynı yazımı seçer.
        return $this->cache->remember('framio_known_places_' . $limit, 1800, function () use ($limit) {
            $places = $this->db->table('framio_seo_entities')->where('type', 'place')->groupBy('name')
                ->selectRaw('name, COUNT(*) as n')->orderByDesc('n')->limit($limit)->pluck('name')->all();
            $out = [];
            foreach ($places as $place) {
                $postIds = $this->db->table('framio_seo_entities')->where('type', 'place')->where('name', $place)->limit(50)->pluck('post_id')->all();
                $city = $this->db->table('framio_seo_entities')->where('type', 'city')->whereIn('post_id', $postIds)
                    ->groupBy('name')->selectRaw('name, COUNT(*) as n')->orderByDesc('n')->value('name');
                $out[] = $city && mb_stripos($place, $city) === false ? $place . ' - ' . $city : $place;
            }

            return $out;
        });
    }
}
