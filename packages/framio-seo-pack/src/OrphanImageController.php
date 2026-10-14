<?php

namespace Framio\SeoPack;

use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Illuminate\Database\ConnectionInterface;

/**
 * Hiçbir mesajda kullanılmayan medya kayıtlarını bulur; silme yalnızca veritabanı kaydını kaldırır (bulut dosyalarına dokunmaz).
 *
 * Kullanım tespiti dosya adının zaman damgalı gövdesine göre yapılır (ör. "1786566666_63 EG 563"); böylece
 * ana görsel, ?w= boyut adresi, eski thumb_/mini_ kopyaları, %20 / &amp; gibi farklı yazımlar ve BBCode id
 * eşleşmesinin hepsi aynı görsel sayılır. Silme anında her kayıt yeniden kontrol edilir.
 */
class OrphanImageController implements RequestHandlerInterface
{
    /** Yeni yüklenen ama henüz gönderilmemiş görseller bu süre dolmadan yetim sayılmaz */
    private const GRACE_HOURS = 24;

    public function __construct(protected ConnectionInterface $db, protected SettingsRepositoryInterface $settings)
    {
    }

    public function handle(Request $request): Response
    {
        \Flarum\Http\RequestUtil::getActor($request)->assertAdmin();

        try {
            $action = $request->getQueryParams()['action'] ?? 'scan';

            if ($action === 'scan') {
                return $this->scanOrphans();
            }
            if ($action === 'delete') {
                return $this->deleteOrphans((array) (((array) $request->getParsedBody())['ids'] ?? []));
            }

            return new JsonResponse(['error' => 'Geçersiz işlem.'], 400);
        } catch (\Throwable $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    protected function getImageTable(): ?string
    {
        $table = resolve(\Framio\SeoPack\Support\SeoSettings::class)->mediaTable();

        return ($table && $this->db->getSchemaBuilder()->hasTable($table)) ? $table : null;
    }

    /** Dosya adının uzantı, boyut ön eki ve sorgu dizesi olmadan çözülmüş gövdesi */
    protected function stem(?string $path): string
    {
        if (!$path) return '';
        $name = basename((string) parse_url($path, PHP_URL_PATH));
        $name = rawurldecode(html_entity_decode($name, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $name = preg_replace('/^(thumb_|mini_)/i', '', $name);

        return (string) preg_replace('/\.(jpe?g|webp|png|gif|avif)$/i', '', $name);
    }

    /** Tüm mesaj içeriklerinden kullanılan görsel gövdelerinin ve BBCode kimliklerinin kümesi */
    protected function usedIndex(): array
    {
        $stems = [];
        $ids = [];

        $this->db->table('posts')->where('type', 'comment')->select('id', 'content')->orderBy('id')
            ->chunk(500, function ($posts) use (&$stems, &$ids) {
                foreach ($posts as $p) {
                    $c = html_entity_decode((string) $p->content, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    if (preg_match_all('~/([^/"\'<>\]]+?)\.(?:jpe?g|webp|png|gif|avif)~i', $c, $m)) {
                        foreach ($m[1] as $n) {
                            $stems[$this->stem($n . '.x')] = true;
                        }
                    }
                    if (preg_match_all('~\bid="?(\d+)"?~', $c, $m)) {
                        foreach ($m[1] as $i) $ids[(int) $i] = true;
                    }
                }
            });

        return [$stems, $ids];
    }

    protected function isUsed(object $img, array $stems, array $ids): bool
    {
        // Kimlik eşleşmesi yanlış pozitif verebilir; "kullanılıyor" demek güvenli taraftır
        if (isset($ids[(int) $img->id])) return true;

        foreach ([$img->path ?? null, $img->thumb_path ?? null, $img->original_path ?? null] as $p) {
            $s = $this->stem($p);
            if ($s !== '' && isset($stems[$s])) return true;
        }

        return false;
    }

    protected function columns(string $table, array $wanted): array
    {
        return array_values(array_intersect($wanted, $this->db->getSchemaBuilder()->getColumnListing($table)));
    }

    protected function scanOrphans(): Response
    {
        $table = $this->getImageTable();
        if (!$table) {
            return new JsonResponse(['images' => [], 'stats' => ['total_images' => 0, 'orphans' => 0]]);
        }

        [$stems, $ids] = $this->usedIndex();
        $images = $this->db->table($table)->select($this->columns($table, ['id', 'path', 'thumb_path', 'original_path', 'created_at']))->get();

        $orphans = [];
        foreach ($images as $img) {
            if ($this->isUsed($img, $stems, $ids)) continue;

            $created = !empty($img->created_at) ? \Carbon\Carbon::parse($img->created_at) : null;
            if ($created && $created->diffInHours(\Carbon\Carbon::now()) < self::GRACE_HOURS) continue;

            $orphans[] = [
                'id' => $img->id,
                'path' => $img->path,
                'thumb_path' => $img->thumb_path ?? null,
                'original_path' => $img->original_path ?? null,
                'created_at' => $img->created_at ?? null,
            ];
        }

        return new JsonResponse([
            'images' => $orphans,
            'stats' => ['total_images' => count($images), 'orphans' => count($orphans), 'grace_hours' => self::GRACE_HOURS],
        ]);
    }

    protected function deleteOrphans(array $ids): Response
    {
        $ids = array_values(array_filter(array_map('intval', $ids)));
        $table = $this->getImageTable();
        if (!$ids || !$table) {
            return new JsonResponse(['error' => 'Silinecek görsel belirtilmedi.'], 400);
        }

        // Tarama ile silme arasında görsel bir mesaja eklenmiş olabilir: yeniden doğrulanır
        [$stems, $usedIds] = $this->usedIndex();
        $rows = $this->db->table($table)->whereIn('id', $ids)->select($this->columns($table, ['id', 'path', 'thumb_path', 'original_path']))->get();

        $deleted = 0;
        $skipped = 0;
        foreach ($rows as $img) {
            if ($this->isUsed($img, $stems, $usedIds)) {
                $skipped++;
                continue;
            }
            $deleted += $this->db->table($table)->where('id', $img->id)->delete();
        }

        $msg = "{$deleted} yetim kayıt veritabanından silindi" . ($skipped ? ", {$skipped} kayıt kullanımda olduğu için atlandı" : '') . '. Bulut dosyalarına dokunulmadı.';

        return new JsonResponse(['message' => $msg, 'deleted_count' => $deleted, 'skipped' => $skipped]);
    }
}
