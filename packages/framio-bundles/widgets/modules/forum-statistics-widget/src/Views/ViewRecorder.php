<?php

namespace Framio\Widgets\ForumStatisticsWidget\Views;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Jaybizzle\CrawlerDetect\CrawlerDetect;

/**
 * Tartışma ve mesaj görüntülenmelerini kaydeder.
 *
 * - Aynı ziyaretçi aynı tartışmayı/mesajı günde bir kez sayılır.
 * - Üyeler kullanıcı kimliğiyle; ziyaretçilerin IP'si saklanmaz. IP + tarayıcı +
 *   gün + sitenin gizli anahtarından geri çözülemeyen bir özet üretilir; özet her
 *   gün değiştiği için ziyaretçi günler arasında izlenemez.
 * - Arama motoru botları ve mesajın kendi yazarı sayılmaz.
 */
class ViewRecorder
{
    public function __construct(protected ConnectionInterface $db, protected CrawlerDetect $crawler, protected SettingsRepositoryInterface $settings)
    {
    }

    public function isCrawler(?string $userAgent): bool
    {
        return !$userAgent || $this->crawler->isCrawler($userAgent);
    }

    protected function visitor(User $actor, ?string $ip, ?string $userAgent): string
    {
        if (!$actor->isGuest()) {
            return sha1('u:' . $actor->id);
        }
        // Siteye özel rastgele anahtar (ilk kullanımda üretilir)
        $secret = (string) $this->settings->get('framio-stats.visitor_salt');
        if ($secret === '') {
            $secret = bin2hex(random_bytes(24));
            $this->settings->set('framio-stats.visitor_salt', $secret);
        }

        return sha1('g:' . $ip . '|' . $userAgent . '|' . Carbon::now()->toDateString() . '|' . $secret);
    }

    /** Tartışmanın görüntülenmesi (discussion-views modülünün olayından) */
    public function recordDiscussion(Discussion $discussion, User $actor, ?string $ip, ?string $userAgent): void
    {
        if ($this->isCrawler($userAgent)) {
            return;
        }
        $this->insert($discussion->id, 0, $actor, $this->visitor($actor, $ip, $userAgent));
    }

    /**
     * Ekranda görülen mesajlar. Yalnızca izleyicinin görebildiği ve o tartışmaya
     * ait mesajlar sayılır. @return int yeni sayılan mesaj sayısı
     */
    public function recordPosts(int $discussionId, array $postIds, User $actor, ?string $ip, ?string $userAgent): int
    {
        if ($this->isCrawler($userAgent)) {
            return 0;
        }
        $ids = array_slice(array_values(array_unique(array_filter(array_map('intval', $postIds)))), 0, 50);
        if (!$ids) {
            return 0;
        }

        $posts = Post::whereVisibleTo($actor)
            ->where('discussion_id', $discussionId)
            ->where('type', 'comment')
            ->whereIn('id', $ids)
            ->get(['id', 'user_id']);

        $visitor = $this->visitor($actor, $ip, $userAgent);
        $counted = 0;
        foreach ($posts as $post) {
            // Kendi mesajını okumak sayılmaz
            if (!$actor->isGuest() && (int) $post->user_id === (int) $actor->id) {
                continue;
            }
            if ($this->insert($discussionId, (int) $post->id, $actor, $visitor)) {
                $this->db->statement(
                    'INSERT INTO ' . $this->db->getTablePrefix() . 'framio_post_views (post_id, views) VALUES (?, 1) ON DUPLICATE KEY UPDATE views = views + 1',
                    [$post->id]
                );
                $counted++;
            }
        }

        return $counted;
    }

    /** @return bool yeni kayıt mı (aynı gün tekrar ise false) */
    protected function insert(int $discussionId, int $postId, User $actor, string $visitor): bool
    {
        return $this->db->table('framio_view_log')->insertOrIgnore([
            'discussion_id' => $discussionId,
            'post_id' => $postId,
            'user_id' => $actor->isGuest() ? null : $actor->id,
            'visitor' => $visitor,
            'viewed_on' => Carbon::now()->toDateString(),
            'created_at' => Carbon::now(),
        ]) > 0;
    }
}
