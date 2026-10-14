<?php

namespace Framio\PostComments\Api;

use Carbon\Carbon;
use Flarum\Http\RequestUtil;
use Flarum\Notification\NotificationSyncer;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Framio\PostComments\Notification\CommentRepliedBlueprint;
use Framio\PostComments\Notification\PostCommentedBlueprint;
use Framio\PostComments\PostComment;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Mesaj yorumları (düz JSON uç noktaları; Flarum mağazasına model eklenmez).
 *
 * GET    /api/post-comments?post=ID        liste
 * POST   /api/post-comments                {post, content, parentId?, photoIndex?, guestName?, website?}
 * PATCH  /api/post-comments/{id}           {content}
 * DELETE /api/post-comments/{id}
 * POST   /api/post-comments/{id}/like      beğen / beğeniyi geri al
 *
 * Mesaj görünürlüğü her istekte istek sahibinin yetkisiyle denetlenir.
 * Sınırlar (uzunluk, bekleme süreleri, ziyaretçi izni) admin ayarlarından gelir.
 */
class CommentsController implements RequestHandlerInterface
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected NotificationSyncer $notifications,
        protected ConnectionInterface $db
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $id = (int) Arr::get($request->getAttribute('routeParameters', []), 'id');
        $isLike = str_ends_with($request->getUri()->getPath(), '/like');

        return match (true) {
            $request->getMethod() === 'GET' => $this->index($request, $actor),
            $request->getMethod() === 'POST' && $isLike => $this->like($actor, $id),
            $request->getMethod() === 'POST' => $this->create($request, $actor),
            $request->getMethod() === 'PATCH' => $this->update($request, $actor, $id),
            $request->getMethod() === 'DELETE' => $this->delete($actor, $id),
            default => $this->error('Desteklenmeyen istek.', 405),
        };
    }

    // ───────────────────────────────────────────────────────── Ayarlar

    private function maxLength(): int
    {
        return max(50, min(5000, (int) $this->settings->get('framio-post-comments.max_length', 1000)));
    }

    private function setting(string $key, int $default): int
    {
        return max(0, (int) $this->settings->get('framio-post-comments.' . $key, $default));
    }

    // ───────────────────────────────────────────────────────── İşlemler

    private function index(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $post = $this->visiblePost($actor, (int) Arr::get($request->getQueryParams(), 'post'));
        if (!$post) {
            return $this->error('Mesaj bulunamadı.', 404);
        }

        $comments = PostComment::with('user')->where('post_id', $post->id)
            ->orderBy('created_at')->orderBy('id')->limit(1000)->get();

        [$counts, $liked] = $this->likeInfo($comments->pluck('id')->all(), $actor);

        return new JsonResponse([
            'data' => $comments->map(fn ($c) => $this->serialize($c, $actor, $post, $counts, $liked))->all(),
            'meta' => [
                'canComment' => $this->canComment($actor),
                'canLike' => !$actor->isGuest(),
                'maxLength' => $this->maxLength(),
            ],
        ]);
    }

    private function create(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $body = (array) $request->getParsedBody();
        $post = $this->visiblePost($actor, (int) Arr::get($body, 'post'));
        if (!$post) {
            return $this->error('Mesaj bulunamadı.', 404);
        }
        if (!$this->canComment($actor)) {
            return $this->error('Yorum yapmak için giriş yapmalısınız.', 403);
        }

        // Bot tuzağı: görünmeyen alan doluysa sessizce reddet
        if (trim((string) Arr::get($body, 'website', '')) !== '') {
            return $this->error('Yorum gönderilemedi.', 422);
        }

        $max = $this->maxLength();
        $content = $this->cleanContent((string) Arr::get($body, 'content', ''));
        if ($content === '') {
            return $this->error('Yorum boş olamaz.', 422);
        }
        if (mb_strlen($content) > $max) {
            return $this->error('Yorum en fazla ' . $max . ' karakter olabilir.', 422);
        }

        // Yanıt: aynı mesajdaki bir yoruma; yanıtın yanıtı üst düzey yoruma bağlanır
        $parent = null;
        if ($parentId = (int) Arr::get($body, 'parentId', 0)) {
            $parent = PostComment::where('post_id', $post->id)->find($parentId);
            if (!$parent) {
                return $this->error('Yanıtlanan yorum bulunamadı.', 422);
            }
            if ($parent->parent_id) {
                $parent = PostComment::find($parent->parent_id) ?: $parent;
            }
        }

        $ip = $this->ip($request);
        if ($wait = $this->floodWait($actor, $ip)) {
            return $this->error("Çok hızlı yorum gönderiyorsunuz. Lütfen {$wait} saniye bekleyin.", 429);
        }

        $comment = new PostComment();
        $comment->post_id = $post->id;
        $comment->content = $content;
        $comment->ip_address = $ip;
        $comment->parent_id = $parent?->id;
        // Yanıt, üst yorumun fotoğrafına aittir
        $photo = $parent ? $parent->photo_index : Arr::get($body, 'photoIndex');
        $comment->photo_index = $photo === null || $photo === '' ? null : max(0, min(200, (int) $photo));

        if ($actor->isGuest()) {
            $name = trim(preg_replace('/\s+/u', ' ', strip_tags((string) Arr::get($body, 'guestName', ''))));
            if (mb_strlen($name) < 2 || mb_strlen($name) > 40) {
                return $this->error('Lütfen 2-40 karakter arasında bir isim yazın.', 422);
            }
            $comment->guest_name = $name;
        } else {
            $comment->user_id = $actor->id;
        }

        $comment->save();
        $comment->setRelation('user', $actor->isGuest() ? null : $actor);

        $this->notify($post, $comment, $parent, $actor);

        return new JsonResponse(['data' => $this->serialize($comment, $actor, $post, [], [])], 201);
    }

    private function update(ServerRequestInterface $request, User $actor, int $id): ResponseInterface
    {
        $comment = PostComment::with('user')->find($id);
        $post = $comment ? $this->visiblePost($actor, $comment->post_id) : null;
        if (!$comment || !$post) {
            return $this->error('Yorum bulunamadı.', 404);
        }
        if (!$this->canEdit($actor, $comment)) {
            return $this->error('Bu yorumu düzenleyemezsiniz.', 403);
        }

        $max = $this->maxLength();
        $content = $this->cleanContent((string) Arr::get((array) $request->getParsedBody(), 'content', ''));
        if ($content === '' || mb_strlen($content) > $max) {
            return $this->error('Yorum 1-' . $max . ' karakter olmalıdır.', 422);
        }

        $comment->content = $content;
        $comment->save();

        [$counts, $liked] = $this->likeInfo([$comment->id], $actor);

        return new JsonResponse(['data' => $this->serialize($comment, $actor, $post, $counts, $liked)]);
    }

    private function delete(User $actor, int $id): ResponseInterface
    {
        $comment = PostComment::find($id);
        $post = $comment ? $this->visiblePost($actor, $comment->post_id) : null;
        if (!$comment || !$post) {
            return $this->error('Yorum bulunamadı.', 404);
        }
        if (!$this->canDelete($actor, $comment, $post)) {
            return $this->error('Bu yorumu silemezsiniz.', 403);
        }

        // Bildirimleri kaldır (yanıtlar veritabanında cascade ile silinir)
        $ids = PostComment::where('parent_id', $comment->id)->pluck('id')->push($comment->id)->map(fn ($v) => (int) $v)->all();
        $this->db->table('notifications')
            ->whereIn('type', ['postCommented', 'postCommentReplied'])
            ->where('subject_id', $post->id)
            ->get(['id', 'data'])
            ->filter(fn ($n) => in_array((int) (json_decode((string) $n->data, true)['commentId'] ?? 0), $ids, true))
            ->each(fn ($n) => $this->db->table('notifications')->where('id', $n->id)->delete());

        $comment->delete();

        return new EmptyResponse(204);
    }

    private function like(User $actor, int $id): ResponseInterface
    {
        if ($actor->isGuest()) {
            return $this->error('Beğenmek için giriş yapmalısınız.', 403);
        }
        $comment = PostComment::find($id);
        if (!$comment || !$this->visiblePost($actor, $comment->post_id)) {
            return $this->error('Yorum bulunamadı.', 404);
        }

        $where = ['comment_id' => $comment->id, 'user_id' => $actor->id];
        $liked = !$this->db->table('post_comment_likes')->where($where)->exists();
        $liked
            ? $this->db->table('post_comment_likes')->insert($where + ['created_at' => Carbon::now()])
            : $this->db->table('post_comment_likes')->where($where)->delete();

        return new JsonResponse([
            'liked' => $liked,
            'likes' => $this->db->table('post_comment_likes')->where('comment_id', $comment->id)->count(),
        ]);
    }

    // ───────────────────────────────────────────────────────── Yardımcılar

    private function notify(Post $post, PostComment $comment, ?PostComment $parent, User $actor): void
    {
        try {
            $sent = [];
            if ($parent && $parent->user_id && (int) $parent->user_id !== (int) $actor->id && ($u = User::find($parent->user_id))) {
                $this->notifications->sync(new CommentRepliedBlueprint($post, $comment), [$u]);
                $sent[] = (int) $u->id;
            }
            $owner = $post->user;
            if ($owner && (int) $owner->id !== (int) $actor->id && !in_array((int) $owner->id, $sent, true)) {
                $this->notifications->sync(new PostCommentedBlueprint($post, $comment), [$owner]);
            }
        } catch (\Throwable $e) {
            // Bildirim hatası yorumu engellemesin
        }
    }

    /** @return array{0: array<int,int>, 1: array<int,bool>} beğeni sayıları ve aktörün beğendikleri */
    private function likeInfo(array $ids, User $actor): array
    {
        if (!$ids) {
            return [[], []];
        }
        $counts = $this->db->table('post_comment_likes')->whereIn('comment_id', $ids)
            ->selectRaw('comment_id, count(*) as c')->groupBy('comment_id')->pluck('c', 'comment_id')->all();
        $liked = $actor->isGuest() ? [] : array_fill_keys(
            $this->db->table('post_comment_likes')->whereIn('comment_id', $ids)->where('user_id', $actor->id)->pluck('comment_id')->all(),
            true
        );

        return [$counts, $liked];
    }

    private function visiblePost(User $actor, int $id): ?Post
    {
        if ($id <= 0) {
            return null;
        }

        return Post::whereVisibleTo($actor)->where('type', 'comment')->whereNull('hidden_at')->find($id);
    }

    private function canComment(User $actor): bool
    {
        if ($actor->isGuest()) {
            return (bool) $this->settings->get('framio-post-comments.allow_guests', '1');
        }

        return !$actor->suspended_until || $actor->suspended_until->isPast();
    }

    private function canEdit(User $actor, PostComment $c): bool
    {
        return !$actor->isGuest() && $c->user_id && (int) $c->user_id === (int) $actor->id;
    }

    private function canDelete(User $actor, PostComment $c, Post $post): bool
    {
        if ($actor->isGuest()) {
            return false;
        }

        return $this->canEdit($actor, $c)
            || $actor->isAdmin()
            || ($post->discussion && $actor->can('hidePosts', $post->discussion));
    }

    /** Aynı kişi/IP için bekleme süresi (saniye); 0 = gönderebilir */
    private function floodWait(User $actor, ?string $ip): int
    {
        $gap = $actor->isGuest() ? $this->setting('guest_interval', 30) : $this->setting('user_interval', 10);
        $q = PostComment::query();
        $actor->isGuest() ? $q->whereNull('user_id')->where('ip_address', $ip) : $q->where('user_id', $actor->id);

        $last = (clone $q)->max('created_at');
        if ($last && $gap > 0) {
            $passed = Carbon::parse($last)->diffInSeconds(Carbon::now(), true);
            if ($passed < $gap) {
                return (int) ceil($gap - $passed);
            }
        }

        // Ziyaretçi: saatlik sınır
        $hourly = $this->setting('guest_hourly', 10);
        if ($actor->isGuest() && $hourly > 0 && (clone $q)->where('created_at', '>', Carbon::now()->subHour())->count() >= $hourly) {
            return 600;
        }

        return 0;
    }

    private function cleanContent(string $text): string
    {
        $text = strip_tags(str_replace("\r\n", "\n", $text));
        $text = preg_replace("/\n{3,}/", "\n\n", $text);

        return trim($text);
    }

    private function ip(ServerRequestInterface $request): ?string
    {
        $ip = Arr::get($request->getServerParams(), 'REMOTE_ADDR');

        return $ip ? substr($ip, 0, 45) : null;
    }

    private function serialize(PostComment $c, User $actor, Post $post, array $counts, array $liked): array
    {
        $user = $c->user;

        return [
            'id' => $c->id,
            'parentId' => $c->parent_id ? (int) $c->parent_id : null,
            'photoIndex' => $c->photo_index === null ? null : (int) $c->photo_index,
            'content' => $c->content,
            'createdAt' => $c->created_at?->toIso8601String(),
            'edited' => $c->updated_at && $c->created_at && $c->updated_at->gt($c->created_at->copy()->addSeconds(5)),
            'likes' => (int) ($counts[$c->id] ?? 0),
            'liked' => !empty($liked[$c->id]),
            'isPostAuthor' => $c->user_id && (int) $c->user_id === (int) $post->user_id,
            'author' => $user ? [
                'name' => $user->display_name ?: $user->username,
                'username' => $user->username,
                'slug' => $user->username,
                'avatarUrl' => $user->avatar_url,
            ] : [
                'name' => $c->guest_name ?: 'Ziyaretçi',
                'guest' => true,
            ],
            'canEdit' => $this->canEdit($actor, $c),
            'canDelete' => $this->canDelete($actor, $c, $post),
        ];
    }

    private function error(string $message, int $status): JsonResponse
    {
        return new JsonResponse(['errors' => [['status' => (string) $status, 'detail' => $message]]], $status);
    }
}
