<?php

namespace Framio\Widgets\ForumStatisticsWidget;

use Carbon\Carbon;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;

/**
 * Forum istatistikleri: bütün sayılar tek yerde, tutarlı kurallarla hesaplanır.
 *
 * Sayım kuralları (admin → Forum İstatistikleri):
 *   exclude_hidden       gizlenmiş/silinmiş konu ve mesajlar sayılmaz
 *   exclude_private      özel (is_private) tartışmalar ve içindeki mesajlar sayılmaz
 *   exclude_unconfirmed  e-postasını onaylamamış hesaplar sayılmaz
 *   exclude_suspended    askıdaki hesaplar sayılmaz
 *
 * Önbellek: içerik/üye olaylarında temizlenir (Listener\FlushStats); çevrimiçi
 * sayısı zamana bağlı olduğu için ayrı ve kısa süreli tutulur.
 */
class StatsService
{
    public const CACHE_KEY = 'framio-stats.stats';
    public const ONLINE_CACHE_KEY = 'framio-stats.online';
    public const PREFIX = 'framio-stats.';

    public function __construct(
        protected Cache $cache,
        protected SettingsRepositoryInterface $settings,
        protected ConnectionInterface $db
    ) {
    }

    public function setting(string $key, $default = null)
    {
        $v = $this->settings->get(self::PREFIX . $key);

        return $v === null || $v === '' ? $default : $v;
    }

    protected function flag(string $key, bool $default): bool
    {
        return (bool) (int) $this->setting($key, $default ? '1' : '0');
    }

    /** Önbellekten istatistikler (+ ayrı önbellekli çevrimiçi bilgisi) */
    public function get(): array
    {
        $ttl = max(0, (int) $this->setting('cache_duration', 600));
        $stats = $ttl > 0 ? $this->cache->remember(self::CACHE_KEY, $ttl, fn () => $this->build()) : $this->build();
        $stats = is_array($stats) ? $stats : [];

        $online = $this->cache->remember(self::ONLINE_CACHE_KEY, 60, fn () => $this->buildOnline());
        $stats['online'] = is_array($online) ? $online : null;

        return $stats;
    }

    public function flush(): void
    {
        $this->cache->forget(self::CACHE_KEY);
    }

    /** Önbelleği temizleyip hemen yeniden hesaplar (admin "Şimdi yenile") */
    public function refresh(): array
    {
        $this->cache->forget(self::CACHE_KEY);
        $this->cache->forget(self::ONLINE_CACHE_KEY);

        return $this->get();
    }

    // ───────────────────────── Hesaplama

    protected function hasColumn(string $table, string $column): bool
    {
        static $cache = [];
        $k = "$table.$column";

        return $cache[$k] ??= $this->db->getSchemaBuilder()->hasColumn($table, $column);
    }

    protected function hasTable(string $table): bool
    {
        static $cache = [];

        return $cache[$table] ??= $this->db->getSchemaBuilder()->hasTable($table);
    }

    protected function discussions(): Builder
    {
        $q = $this->db->table('discussions');
        if ($this->flag('exclude_hidden', true)) {
            $q->whereNull('hidden_at');
        }
        if ($this->flag('exclude_private', true) && $this->hasColumn('discussions', 'is_private')) {
            $q->where('is_private', false);
        }

        return $q;
    }

    protected function posts(): Builder
    {
        $q = $this->db->table('posts')->where('posts.type', 'comment');
        $hidden = $this->flag('exclude_hidden', true);
        $private = $this->flag('exclude_private', true);

        if ($hidden) {
            $q->whereNull('posts.hidden_at');
        }
        if ($private && $this->hasColumn('posts', 'is_private')) {
            $q->where('posts.is_private', false);
        }
        if ($hidden || ($private && $this->hasColumn('discussions', 'is_private'))) {
            // Mesajın tartışması da sayım kurallarına uymalı
            $q->join('discussions', 'discussions.id', '=', 'posts.discussion_id');
            if ($hidden) {
                $q->whereNull('discussions.hidden_at');
            }
            if ($private && $this->hasColumn('discussions', 'is_private')) {
                $q->where('discussions.is_private', false);
            }
        }

        return $q;
    }

    protected function users(): Builder
    {
        $q = $this->db->table('users');
        if ($this->flag('exclude_unconfirmed', true)) {
            $q->where('is_email_confirmed', true);
        }
        if ($this->flag('exclude_suspended', false) && $this->hasColumn('users', 'suspended_until')) {
            $q->where(fn ($w) => $w->whereNull('suspended_until')->orWhere('suspended_until', '<', Carbon::now()));
        }

        return $q;
    }

    protected function photos(): ?Builder
    {
        $table = (string) $this->setting('photo_table', 'spotter_images');

        return $table !== '' && $this->hasTable($table) ? $this->db->table($table) : null;
    }

    protected function build(): array
    {
        $today = Carbon::now()->startOfDay();
        $week = Carbon::now()->subDays(7);

        $photos = $this->photos();
        $photoTable = (string) $this->setting('photo_table', 'spotter_images');

        $latest = $this->users()->orderByDesc('joined_at')->first(['id', 'username', 'joined_at']);

        // Haftanın en aktif üyesi: son 7 günde en çok mesaj yazan
        $top = $this->posts()
            ->whereNotNull('posts.user_id')
            ->where('posts.created_at', '>=', $week)
            ->groupBy('posts.user_id')
            ->orderByRaw('COUNT(*) DESC')
            ->select('posts.user_id')
            ->selectRaw('COUNT(*) as c')
            ->first();
        $topUser = $top ? $this->db->table('users')->where('id', $top->user_id)->first(['id', 'username']) : null;

        return [
            'discussions' => ['total' => $this->discussions()->count(), 'today' => $this->discussions()->where('created_at', '>=', $today)->count()],
            'posts' => ['total' => $this->posts()->count(), 'today' => $this->posts()->where('posts.created_at', '>=', $today)->count()],
            'users' => [
                'total' => $this->users()->count(),
                'today' => $this->users()->where('joined_at', '>=', $today)->count(),
                'week' => $this->users()->where('joined_at', '>=', $week)->count(),
            ],
            'photos' => $photos ? [
                'total' => $photos->count(),
                'today' => $this->hasColumn($photoTable, 'created_at') ? $this->db->table($photoTable)->where('created_at', '>=', $today)->count() : null,
            ] : null,
            'tags' => $this->hasTable('tags') ? ['total' => $this->db->table('tags')->count()] : null,
            // Son katılan üyeler (Yeni Üyeler kartı ve istatistik sayfası)
            'newMembers' => $this->users()->orderByDesc('joined_at')->limit(8)->get(['id', 'username', 'joined_at'])
                ->map(fn ($u) => $this->userPayload($u) + ['joinedAt' => $u->joined_at ? Carbon::parse($u->joined_at)->toIso8601String() : null])->all(),
            'latestUser' => $latest ? $this->userPayload($latest) + ['joinedAt' => $latest->joined_at ? Carbon::parse($latest->joined_at)->toIso8601String() : null] : null,
            'topWeek' => $topUser ? $this->userPayload($topUser) + ['count' => (int) $top->c] : null,
            'computedAt' => Carbon::now()->toIso8601String(),
        ];
    }

    /** Şu an çevrimiçi üyeler ve rekor */
    protected function buildOnline(): array
    {
        $minutes = max(1, (int) $this->setting('online_minutes', 5));
        $now = $this->db->table('users')->where('last_seen_at', '>=', Carbon::now()->subMinutes($minutes))->count();

        $record = json_decode((string) $this->setting('online_record', ''), true);
        if (!is_array($record) || $now > (int) ($record['count'] ?? 0)) {
            $record = ['count' => $now, 'at' => Carbon::now()->toIso8601String()];
            $this->settings->set(self::PREFIX . 'online_record', json_encode($record));
        }

        return ['now' => $now, 'record' => (int) $record['count'], 'recordAt' => $record['at'] ?? null, 'minutes' => $minutes];
    }

    /** Kullanıcı özeti; avatar adresini Flarum'un kendi modeli üretir */
    protected function userPayload($row): array
    {
        $u = User::find($row->id);

        return [
            'id' => (int) $row->id,
            'username' => $row->username,
            'displayName' => ($u ? $u->display_name : null) ?: $row->username,
            'avatar' => $u ? $u->avatar_url : null,
        ];
    }
}
