<?php

namespace Framio\UploadExif\Api\Controller;

use Carbon\Carbon;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Framio\UploadExif\Ai\ModelRefs;
use GuzzleHttp\Client;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Throwable;

/**
 * Admin: Framio AI model referans görselleri
 *   GET    /framio-media/ai-refs                      → liste
 *   POST   /framio-media/ai-refs                      → ekle (dosya yükleme ya da url; brand, model, tag_slugs, source, note)
 *   POST   /framio-media/ai-refs?delete=ID            → sil
 *   GET    /framio-media/ai-refs?find=forum&brand&model → forumda bu modelle künyelenmiş fotoğraflar
 *   GET    /framio-media/ai-refs?find=web&q=           → Google Programlanabilir Arama (anahtar admin ayarında)
 */
class ModelRefsController implements RequestHandlerInterface
{
    public function __construct(protected ConnectionInterface $db, protected SettingsRepositoryInterface $settings)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();
        $q = $request->getQueryParams();
        $table = $this->db->table(ModelRefs::TABLE);

        if ($request->getMethod() === 'GET') {
            if (($q['find'] ?? '') === 'forum') return new JsonResponse(['data' => $this->findForum((string) ($q['brand'] ?? ''), (string) ($q['model'] ?? ''))]);
            if (($q['find'] ?? '') === 'web') return $this->findWeb((string) ($q['q'] ?? ''));

            return new JsonResponse(['data' => $table->orderBy('brand')->orderBy('model')->orderByDesc('id')->get()]);
        }

        if (!empty($q['delete'])) {
            $row = $table->where('id', (int) $q['delete'])->first();
            if ($row && $row->source === 'upload' && str_starts_with((string) $row->url, '/assets/ai-refs/')) @unlink(public_path(ltrim($row->url, '/')));
            $this->db->table(ModelRefs::TABLE)->where('id', (int) $q['delete'])->delete();

            return new JsonResponse(['ok' => true]);
        }

        $body = (array) $request->getParsedBody();
        $brand = trim((string) Arr::get($body, 'brand', ''));
        $model = trim((string) Arr::get($body, 'model', ''));
        if ($brand === '' || $model === '') return new JsonResponse(['error' => 'Marka ve model gerekli.'], 422);

        $urls = [];
        $source = in_array(Arr::get($body, 'source'), ['forum', 'web', 'url'], true) ? Arr::get($body, 'source') : 'url';
        $file = $request->getUploadedFiles()['image'] ?? null;
        if ($file && $file->getError() === UPLOAD_ERR_OK) {
            $mime = (string) $file->getClientMediaType();
            if (!preg_match('#^image/(jpe?g|png|webp)$#', $mime)) return new JsonResponse(['error' => 'Yalnızca JPEG, PNG ya da WebP.'], 422);
            $dir = public_path('assets/ai-refs');
            if (!is_dir($dir)) @mkdir($dir, 0755, true);
            $name = date('Ymd_His') . '_' . substr(sha1(uniqid('', true)), 0, 10) . '.' . (str_contains($mime, 'png') ? 'png' : (str_contains($mime, 'webp') ? 'webp' : 'jpg'));
            $file->moveTo($dir . '/' . $name);
            $urls[] = '/assets/ai-refs/' . $name;
            $source = 'upload';
        } else {
            foreach ((array) Arr::get($body, 'urls', [Arr::get($body, 'url')]) as $u) {
                if (is_string($u) && preg_match('#^https?://#i', $u)) $urls[] = mb_substr($u, 0, 2000);
            }
        }
        if (!$urls) return new JsonResponse(['error' => 'Görsel ya da adres gerekli.'], 422);

        foreach ($urls as $u) {
            $this->db->table(ModelRefs::TABLE)->insert([
                'brand' => mb_substr($brand, 0, 100), 'model' => mb_substr($model, 0, 160),
                'tag_slugs' => mb_substr(trim((string) Arr::get($body, 'tag_slugs', '')), 0, 255) ?: null,
                'source' => $source, 'url' => $u, 'note' => mb_substr(trim((string) Arr::get($body, 'note', '')), 0, 255) ?: null,
                'created_at' => Carbon::now(),
            ]);
        }

        return new JsonResponse(['ok' => true, 'added' => count($urls)]);
    }

    /** Forumda bu marka/modelle künyelenmiş fotoğraflar (SEO varlık tablosundan) */
    protected function findForum(string $brand, string $model): array
    {
        if (!$this->db->getSchemaBuilder()->hasTable('framio_seo_entities') || $model === '') return [];
        $names = array_unique(array_filter([trim($brand . ' ' . $model), $model]));

        return $this->db->table('framio_seo_entities')->where('type', 'model')->whereIn('name', $names)->whereNotNull('image_url')
            ->orderByDesc('post_id')->limit(24)->pluck('image_url')->unique()->values()->all();
    }

    /** Google Programlanabilir Arama (Custom Search JSON API) görsel araması */
    protected function findWeb(string $q): ResponseInterface
    {
        $key = trim((string) $this->settings->get('framio-upload-exif.ai_cse_key'));
        $cx = trim((string) $this->settings->get('framio-upload-exif.ai_cse_cx'));
        if ($key === '' || $cx === '') return new JsonResponse(['error' => 'Web araması için Google Programlanabilir Arama anahtarı ve arama motoru kimliği (cx) ayarlardan girilmeli.'], 422);
        if (trim($q) === '') return new JsonResponse(['data' => []]);
        try {
            $res = (new Client(['timeout' => 8]))->get('https://www.googleapis.com/customsearch/v1', ['query' => [
                'key' => $key, 'cx' => $cx, 'q' => $q, 'searchType' => 'image', 'num' => 10, 'safe' => 'active', 'imgSize' => 'large',
            ]]);
            $items = json_decode((string) $res->getBody(), true)['items'] ?? [];

            return new JsonResponse(['data' => array_map(fn ($i) => ['url' => $i['link'] ?? '', 'thumb' => $i['image']['thumbnailLink'] ?? ($i['link'] ?? ''), 'title' => $i['title'] ?? '', 'site' => $i['displayLink'] ?? ''], $items)]);
        } catch (Throwable $e) {
            return new JsonResponse(['error' => 'Web araması yapılamadı: ' . $e->getMessage()], 502);
        }
    }
}
