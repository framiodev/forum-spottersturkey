<?php

namespace Framio\UploadExif\Ai;

use Flarum\Settings\SettingsRepositoryInterface;
use GuzzleHttp\Client;
use GuzzleHttp\Promise\PromiseInterface;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;

/**
 * Görsel benzerlik: Gemini görsel gömmesi (gemini-embedding-2) ile forumdaki künyeli
 * fotoğraflar arasında en yakın olanı bulur. Anahtar, admin'in Vision AI sağlayıcı
 * listesindeki ilk etkin Gemini anahtarıdır.
 */
class VisionSimilarity
{
    public const TABLE = 'framio_vision_embeddings';
    public const MODEL = 'gemini-embedding-2';
    public const DIMS = 256;

    public function __construct(
        protected ConnectionInterface $db,
        protected SettingsRepositoryInterface $settings,
        protected Cache $cache,
        protected VisionAnalyzer $analyzer
    ) {
    }

    public function available(): bool
    {
        return $this->settings->get('framio-upload-exif.ai_similarity', '1') !== '0'
            && $this->key() !== null
            && $this->db->getSchemaBuilder()->hasTable(self::TABLE);
    }

    public function key(): ?string
    {
        $rows = json_decode((string) $this->settings->get('framio-upload-exif.ai_providers', '[]'), true);
        foreach (is_array($rows) ? $rows : [] as $r) {
            if (($r['provider'] ?? '') === 'gemini' && ($r['enabled'] ?? true) && trim($r['key'] ?? '') !== '') {
                return trim($r['key']);
            }
        }
        if ($this->settings->get('framio-upload-exif.ai_provider') === 'gemini' && trim((string) $this->settings->get('framio-upload-exif.ai_api_key')) !== '') {
            return trim((string) $this->settings->get('framio-upload-exif.ai_api_key'));
        }

        return null;
    }

    public function threshold(): float
    {
        return max(0.5, min(0.99, (float) ($this->settings->get('framio-upload-exif.ai_similarity_threshold') ?: 0.92)));
    }

    /** Görsel gömmesi isteği (JPEG'e çevrilir; Gemini WebP kabul etmez) */
    public function embedAsync(Client $client, string $bytes): PromiseInterface
    {
        [$jpeg] = $this->analyzer->shrink($bytes, 'image/jpeg', 512, true);

        $send = fn ($model) => $client->postAsync('https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':embedContent', [
            'headers' => ['x-goog-api-key' => $this->key()],
            'json' => [
                'content' => ['parts' => [['inline_data' => ['mime_type' => 'image/jpeg', 'data' => base64_encode($jpeg)]]]],
                'output_dimensionality' => self::DIMS,
            ],
            // Yükleme anında ana yanıtı bekletmesin
            'timeout' => 2.5,
        ]);

        // Model bazı hesaplarda yalnızca "-preview" adıyla açık
        return $send(self::MODEL)->otherwise(function ($e) use ($send) {
            if ($e instanceof \GuzzleHttp\Exception\ClientException && $e->getResponse()->getStatusCode() === 404) {
                return $send(self::MODEL . '-preview');
            }
            throw $e;
        })->then(function ($res) {
            $json = json_decode((string) $res->getBody(), true);
            $v = $json['embedding']['values'] ?? $json['embeddings'][0]['values'] ?? null;
            if (!is_array($v) || !$v) {
                throw new \RuntimeException('Gömme boş döndü');
            }

            return $this->normalize(array_map('floatval', $v));
        });
    }

    public function normalize(array $v): array
    {
        $n = sqrt(array_sum(array_map(fn ($x) => $x * $x, $v))) ?: 1;

        return array_map(fn ($x) => $x / $n, $v);
    }

    public function pack(array $v): string
    {
        return pack('g*', ...$v);
    }

    public function unpack(string $bin): array
    {
        return array_values(unpack('g*', $bin));
    }

    /**
     * En benzer N künyeli fotoğraf (büyükten küçüğe).
     *
     * @return array<int,array{post_id:int, image_url:string, score:float}>
     */
    public function nearestMany(array $vec, int $limit = 5): array
    {
        $top = [];
        foreach ($this->db->table(self::TABLE)->whereNotNull('vec')->select('post_id', 'image_url', 'vec')->cursor() as $row) {
            $v = $this->unpack($row->vec);
            $dot = 0.0;
            foreach ($vec as $i => $x) {
                $dot += $x * ($v[$i] ?? 0);
            }
            if (count($top) < $limit || $dot > $top[count($top) - 1]['score']) {
                $top[] = ['post_id' => (int) $row->post_id, 'image_url' => $row->image_url, 'score' => $dot];
                usort($top, fn ($a, $b) => $b['score'] <=> $a['score']);
                $top = array_slice($top, 0, $limit);
            }
        }

        return $top;
    }

    /**
     * En benzer künyeli fotoğraf.
     *
     * @return array{post_id:int, image_url:string, score:float}|null
     */
    public function nearest(array $vec, ?array $postIds = null): ?array
    {
        $best = null;
        $q = $this->db->table(self::TABLE)->whereNotNull('vec')->select('post_id', 'image_url', 'vec');
        if ($postIds !== null) {
            $q->whereIn('post_id', $postIds ?: [0]);
        }
        foreach ($q->cursor() as $row) {
            $v = $this->unpack($row->vec);
            $dot = 0.0;
            foreach ($vec as $i => $x) {
                $dot += $x * ($v[$i] ?? 0);
            }
            if (!$best || $dot > $best['score']) {
                $best = ['post_id' => (int) $row->post_id, 'image_url' => $row->image_url, 'score' => $dot];
            }
        }

        return $best;
    }
}
