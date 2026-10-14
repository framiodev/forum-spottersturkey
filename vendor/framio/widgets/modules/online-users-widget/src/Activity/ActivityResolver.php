<?php

namespace FoF\OnlineUsers\Activity;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * Üyelerin anlık etkinliği: kaydetme ve izleyiciye göre metne çevirme.
 *
 * Gizlilik:
 *  - Etkinlik yalnızca "framio.viewUserActivity" izni olana gösterilir.
 *  - Kullanıcı çevrimiçi durumunu gizlediyse (discloseOnline=false) ya da
 *    etkinliğini gizlediyse (framioDiscloseActivity=false) gösterilmez;
 *    "user.viewLastSeenAt" izni olanlar (yöneticiler) bu tercihleri aşar.
 *  - Tartışma/kategori/profil adları izleyicinin görebildiği içerikse yazılır;
 *    göremiyorsa yalnızca "Forumda geziniyor" gösterilir.
 *  - Özel mesajlarda yalnızca "Özel mesajlarda" yazılır.
 *  - Yazılan taslak metin hiçbir zaman kaydedilmez.
 */
class ActivityResolver
{
    public const TYPES = [
        'home', 'index', 'tag', 'discussion', 'profile',
        'composing_reply', 'composing_discussion', 'composing_edit',
        'search', 'notifications', 'settings', 'messages', 'other',
    ];

    public function __construct(
        protected ConnectionInterface $db,
        protected SettingsRepositoryInterface $settings,
        protected UrlGenerator $url
    ) {
    }

    public function enabled(): bool
    {
        return (bool) (int) ($this->settings->get('framio-activity.enabled') ?? 1);
    }

    /** Etkinlik "güncel" sayılan süre (dakika): çevrimiçi sayılma süresiyle aynı */
    public function freshMinutes(): int
    {
        return max(1, (int) ($this->settings->get('fof-online-users-widget.last_seen_interval') ?: 5));
    }

    public function record(User $user, string $type, ?int $subjectId, ?string $extra): void
    {
        if (!in_array($type, self::TYPES, true)) {
            $type = 'other';
        }
        $this->db->table('framio_user_activity')->updateOrInsert(
            ['user_id' => $user->id],
            [
                'type' => $type,
                'subject_id' => $subjectId ?: null,
                'extra' => $extra !== null ? mb_substr(preg_replace('/[^a-z_-]/i', '', $extra), 0, 32) : null,
                'updated_at' => Carbon::now(),
            ]
        );
    }

    public function canView(User $actor): bool
    {
        return $this->enabled() && !$actor->isGuest() && $actor->hasPermission('framio.viewUserActivity');
    }

    /** Hedef kullanıcı etkinliğini paylaşıyor mu (izleyiciye göre) */
    public function discloses(User $target, User $actor): bool
    {
        if ($actor->hasPermission('user.viewLastSeenAt') || (int) $actor->id === (int) $target->id) {
            return true;
        }
        $prefs = $target->preferences ?? [];

        return ($prefs['discloseOnline'] ?? true) !== false && ($prefs['framioDiscloseActivity'] ?? true) !== false;
    }

    /** @param int[] $userIds  @return array<int, object> user_id => satır (yalnızca güncel olanlar) */
    public function rows(array $userIds): array
    {
        if (!$userIds) {
            return [];
        }

        return $this->db->table('framio_user_activity')
            ->whereIn('user_id', $userIds)
            ->where('updated_at', '>=', Carbon::now()->subMinutes($this->freshMinutes()))
            ->get()
            ->keyBy('user_id')
            ->all();
    }

    /** Tek kullanıcı için (profil kartı) */
    public function forUser(User $target, User $actor): ?array
    {
        if (!$this->canView($actor) || !$this->discloses($target, $actor)) {
            return null;
        }
        $row = $this->rows([$target->id])[$target->id] ?? null;

        return $row ? $this->describe($row, $actor, $target) : null;
    }

    /** Satırı izleyicinin görebileceği metne ve bağlantıya çevirir */
    public function describe(object $row, User $actor, User $target): array
    {
        $generic = ['icon' => 'fas fa-compass', 'text' => 'Forumda geziniyor', 'href' => null];
        $d = null;
        $id = $row->subject_id ? (int) $row->subject_id : null;

        switch ($row->type) {
            case 'home':
                $d = ['icon' => 'fas fa-home', 'text' => 'Ana sayfada', 'href' => $this->url->to('forum')->base()];
                break;
            case 'index':
                $d = match ($row->extra) {
                    'feed' => ['icon' => 'fas fa-stream', 'text' => 'Akış\'ta', 'href' => $this->url->to('forum')->route('index') . '?sort=feed'],
                    'gallery' => ['icon' => 'fas fa-camera-retro', 'text' => 'Galeri\'de', 'href' => $this->url->to('forum')->route('index') . '?sort=gallery'],
                    default => ['icon' => 'far fa-comments', 'text' => 'Tartışmalara göz atıyor', 'href' => $this->url->to('forum')->route('index')],
                };
                break;
            case 'tag':
                $tag = $id && class_exists(\Flarum\Tags\Tag::class) ? \Flarum\Tags\Tag::whereVisibleTo($actor)->find($id) : null;
                $d = $tag ? ['icon' => $tag->icon ?: 'fas fa-tag', 'text' => 'kategorisinde geziniyor', 'subject' => $tag->name, 'href' => $this->url->to('forum')->route('tag', ['slug' => $tag->slug])] : null;
                break;
            case 'discussion':
            case 'composing_reply':
            case 'composing_edit':
                $disc = $id ? Discussion::whereVisibleTo($actor)->find($id) : null;
                if ($disc) {
                    $href = $this->url->to('forum')->route('discussion', ['id' => $disc->id . ($disc->slug ? '-' . $disc->slug : '')]);
                    $d = match ($row->type) {
                        'composing_reply' => ['icon' => 'fas fa-pen', 'text' => 'tartışmasına yanıt yazıyor', 'subject' => $disc->title, 'href' => $href, 'writing' => true],
                        'composing_edit' => ['icon' => 'fas fa-edit', 'text' => 'tartışmasında mesajını düzenliyor', 'subject' => $disc->title, 'href' => $href, 'writing' => true],
                        default => ['icon' => 'far fa-eye', 'text' => 'tartışmasını inceliyor', 'subject' => $disc->title, 'href' => $href],
                    };
                } elseif ($row->type !== 'discussion') {
                    $d = ['icon' => 'fas fa-pen', 'text' => 'Bir mesaj yazıyor', 'href' => null, 'writing' => true];
                }
                break;
            case 'profile':
                if ($id && $id === (int) $target->id) {
                    $d = ['icon' => 'far fa-user', 'text' => 'Kendi profilinde', 'href' => null];
                } else {
                    $u = $id ? User::whereVisibleTo($actor)->find($id) : null;
                    $d = $u ? ['icon' => 'far fa-id-badge', 'text' => 'profiline bakıyor', 'subject' => $u->display_name, 'href' => $this->url->to('forum')->route('user', ['username' => $u->username])] : null;
                }
                break;
            case 'composing_discussion':
                $d = ['icon' => 'fas fa-plus-circle', 'text' => 'Yeni bir tartışma başlatıyor', 'href' => null, 'writing' => true];
                break;
            case 'search':
                $d = ['icon' => 'fas fa-search', 'text' => 'Arama yapıyor', 'href' => null];
                break;
            case 'notifications':
                $d = ['icon' => 'far fa-bell', 'text' => 'Bildirimlerine bakıyor', 'href' => null];
                break;
            case 'settings':
                $d = ['icon' => 'fas fa-cog', 'text' => 'Ayarlarında', 'href' => null];
                break;
            case 'messages':
                $d = ['icon' => 'far fa-envelope', 'text' => 'Özel mesajlarda', 'href' => null];
                break;
        }

        $d = $d ?: $generic;
        $d['type'] = $row->type;
        $d['since'] = $row->updated_at ? Carbon::parse($row->updated_at)->toIso8601String() : null;

        return $d;
    }
}
