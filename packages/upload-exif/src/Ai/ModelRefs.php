<?php

namespace Framio\UploadExif\Ai;

use GuzzleHttp\Client;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Throwable;

/**
 * Model referans görselleri: doğrulama sorusunda yapay zekâya "bu model böyle görünür" örnekleri.
 * Görseller 384 px'e küçültülüp önbellekte tutulur (her analizde yeniden indirilmez).
 */
class ModelRefs
{
    public const TABLE = 'framio_ai_model_refs';

    public function __construct(protected ConnectionInterface $db, protected Cache $cache, protected VisionAnalyzer $vision)
    {
    }

    public function available(): bool
    {
        return $this->db->getSchemaBuilder()->hasTable(self::TABLE);
    }

    /**
     * Kategoriye uyan referanslar: her modelden en çok 2 görsel, toplam en çok $max görsel.
     * @return array<int, array{label:string, b64:string, mime:string}>
     */
    public function forCategory(array $slugs, int $max = 10): array
    {
        if (!$this->available()) return [];
        $rows = $this->db->table(self::TABLE)->orderByDesc('id')->limit(300)->get();
        $per = [];
        $picked = [];
        foreach ($rows as $r) {
            $scope = array_filter(array_map('trim', explode(',', (string) $r->tag_slugs)));
            if ($scope && !array_intersect($scope, $slugs)) continue;
            $key = mb_strtolower($r->brand . '|' . $r->model);
            if (($per[$key] ?? 0) >= 2) continue;
            $per[$key] = ($per[$key] ?? 0) + 1;
            $picked[] = $r;
        }
        $out = [];
        $client = new Client(['timeout' => 4, 'connect_timeout' => 2]);
        foreach ($picked as $r) {
            if (count($out) >= $max) break;
            $img = $this->image((string) $r->url, $client);
            if ($img) $out[] = ['label' => trim($r->brand . ' ' . $r->model) . ($r->note ? ' (' . $r->note . ')' : ''), 'b64' => $img, 'mime' => 'image/jpeg'];
        }

        return $out;
    }

    protected function image(string $url, Client $client): ?string
    {
        $key = 'framio_ai_ref_' . sha1($url);
        $hit = $this->cache->get($key);
        if (is_string($hit)) return $hit !== '' ? $hit : null;
        $b64 = '';
        try {
            $bytes = str_starts_with($url, '/') && is_file(public_path(ltrim($url, '/')))
                ? (string) file_get_contents(public_path(ltrim($url, '/')))
                : (string) $client->get($url)->getBody();
            [$small] = $this->vision->shrink($bytes, 'image/jpeg', 384, true);
            $b64 = base64_encode($small);
        } catch (Throwable $e) {
        }
        $this->cache->put($key, $b64, $b64 !== '' ? 60 * 60 * 24 * 7 : 600);

        return $b64 !== '' ? $b64 : null;
    }
}
