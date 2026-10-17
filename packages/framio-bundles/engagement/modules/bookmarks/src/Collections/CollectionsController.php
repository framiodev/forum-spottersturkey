<?php

namespace FoF\Bookmarks\Collections;

use Carbon\Carbon;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Yer imi kitaplıkları:
 *   GET    /framio/bookmark-collections            → kitaplıklar (sayı ve kapak görseliyle)
 *   POST   /framio/bookmark-collections            {name}            → yeni kitaplık
 *   PATCH  /framio/bookmark-collections/{id}       {name}            → yeniden adlandır
 *   DELETE /framio/bookmark-collections/{id}                         → sil (yer imleri kalır)
 *   POST   /framio/bookmark-collections/assign     {post_id, collection_id|null} → mesajı kitaplığa kaydet
 */
class CollectionsController implements RequestHandlerInterface
{
    protected const TABLE = 'framio_bookmark_collections';

    public function __construct(protected ConnectionInterface $db)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $method = $request->getMethod();
        $id = (int) Arr::get($request->getQueryParams(), 'id', 0);
        $body = (array) ($request->getParsedBody() ?: []);
        $path = $request->getUri()->getPath();

        if ($method === 'POST' && str_ends_with($path, '/assign')) {
            return $this->assign($actor->id, (int) Arr::get($body, 'post_id'), Arr::get($body, 'collection_id'));
        }
        if ($method === 'POST') {
            $name = $this->name(Arr::get($body, 'name'));
            if ($name === '') return new JsonResponse(['error' => 'Kitaplık adı boş olamaz.'], 422);
            if ($this->db->table(self::TABLE)->where('user_id', $actor->id)->count() >= 50) {
                return new JsonResponse(['error' => 'En fazla 50 kitaplık oluşturabilirsiniz.'], 422);
            }
            $newId = $this->db->table(self::TABLE)->insertGetId([
                'user_id' => $actor->id,
                'name' => $name,
                'position' => (int) $this->db->table(self::TABLE)->where('user_id', $actor->id)->max('position') + 1,
                'created_at' => Carbon::now(),
            ]);

            return new JsonResponse(['id' => $newId, 'collections' => $this->list($actor->id)], 201);
        }

        $own = $id ? $this->db->table(self::TABLE)->where('id', $id)->where('user_id', $actor->id)->first() : null;
        if (in_array($method, ['PATCH', 'DELETE'], true) && !$own) {
            return new JsonResponse(['error' => 'Kitaplık bulunamadı.'], 404);
        }
        if ($method === 'PATCH') {
            $name = $this->name(Arr::get($body, 'name'));
            if ($name === '') return new JsonResponse(['error' => 'Kitaplık adı boş olamaz.'], 422);
            $this->db->table(self::TABLE)->where('id', $id)->update(['name' => $name]);
        } elseif ($method === 'DELETE') {
            $this->db->table('post_user_bookmark')->where('user_id', $actor->id)->where('collection_id', $id)->update(['collection_id' => null]);
            $this->db->table(self::TABLE)->where('id', $id)->delete();
        }

        return new JsonResponse(['collections' => $this->list($actor->id)]);
    }

    protected function name($value): string
    {
        return mb_substr(trim(preg_replace('/\s+/u', ' ', strip_tags((string) $value))), 0, 80);
    }

    /** Kullanıcının kitaplıkları; her biri için kayıt sayısı ve son kaydedilen mesajın ilk görseli (kapak) */
    protected function list(int $userId): array
    {
        $rows = $this->db->table(self::TABLE)->where('user_id', $userId)->orderBy('position')->orderBy('id')->get();
        $counts = $this->db->table('post_user_bookmark')->where('user_id', $userId)->whereNotNull('collection_id')
            ->groupBy('collection_id')->selectRaw('collection_id, COUNT(*) as n')->pluck('n', 'collection_id')->all();

        return $rows->map(function ($r) use ($userId, $counts) {
            $postId = $this->db->table('post_user_bookmark')->where('user_id', $userId)->where('collection_id', $r->id)
                ->orderByDesc('created_at')->value('post_id');

            return [
                'id' => (int) $r->id,
                'name' => $r->name,
                'count' => (int) ($counts[$r->id] ?? 0),
                'cover' => $postId ? $this->cover((int) $postId) : null,
            ];
        })->all();
    }

    protected function cover(int $postId): ?string
    {
        $post = Post::find($postId);
        if (!$post || $post->type !== 'comment') return null;
        try {
            $html = (string) $post->formatContent();
        } catch (\Throwable $e) {
            return null;
        }

        return preg_match('/<img[^>]+src="([^"]+)"/i', $html, $m) ? html_entity_decode($m[1]) : null;
    }

    protected function assign(int $userId, int $postId, $collectionId): ResponseInterface
    {
        $post = $postId ? Post::find($postId) : null;
        if (!$post) return new JsonResponse(['error' => 'Mesaj bulunamadı.'], 404);

        $collectionId = $collectionId ? (int) $collectionId : null;
        if ($collectionId && !$this->db->table(self::TABLE)->where('id', $collectionId)->where('user_id', $userId)->exists()) {
            return new JsonResponse(['error' => 'Kitaplık bulunamadı.'], 404);
        }

        // Kitaplığa kaydetmek mesajı yer imlerine de ekler
        $exists = $this->db->table('post_user_bookmark')->where('post_id', $postId)->where('user_id', $userId)->exists();
        if ($exists) {
            $this->db->table('post_user_bookmark')->where('post_id', $postId)->where('user_id', $userId)->update(['collection_id' => $collectionId]);
        } else {
            $this->db->table('post_user_bookmark')->insert(['post_id' => $postId, 'user_id' => $userId, 'collection_id' => $collectionId, 'created_at' => Carbon::now()]);
        }

        return new JsonResponse(['ok' => true, 'post_id' => $postId, 'collection_id' => $collectionId, 'collections' => $this->list($userId)]);
    }
}
