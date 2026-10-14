<?php

namespace Framio\SeoPack\Database;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;

class SeoAd extends AbstractModel
{
    protected $table = 'framio_seo_ads';

    public const LOCATIONS = ['header_top', 'header_bottom', 'discussion_top', 'discussion_between_posts', 'discussion_bottom', 'sidebar', 'footer', 'floating'];
    public const TYPES = ['adsense', 'image', 'custom_code'];
    public const FORMATS = ['inline', 'sticky', 'popup'];

    protected $fillable = [
        'name', 'location', 'page_scope', 'tag_slugs', 'type', 'format', 'code', 'adsense_slot', 'adsense_format',
        'banner_image_url', 'banner_target_url', 'post_interval', 'delay_seconds', 'frequency_hours',
        'is_active', 'desktop_visible', 'mobile_visible', 'hide_for_members', 'starts_at', 'ends_at',
        'impressions_count', 'clicks_count', 'estimated_earnings',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'desktop_visible' => 'boolean',
        'mobile_visible' => 'boolean',
        'hide_for_members' => 'boolean',
        'post_interval' => 'integer',
        'delay_seconds' => 'integer',
        'frequency_hours' => 'integer',
        'impressions_count' => 'integer',
        'clicks_count' => 'integer',
        'estimated_earnings' => 'float',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    /** Şu an yayında mı (aktif + tarih aralığında) */
    public function isLive(): bool
    {
        $now = Carbon::now();

        return $this->is_active
            && (!$this->starts_at || $this->starts_at->lte($now))
            && (!$this->ends_at || $this->ends_at->gte($now));
    }

    /** Ziyaretçi tarafına giden alanlar (istatistik ve gelir bilgisi gönderilmez) */
    public function toForumArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'location' => $this->location,
            'page_scope' => $this->page_scope ?: 'all',
            'tag_slugs' => array_values(array_filter(array_map('trim', explode(',', (string) $this->tag_slugs)))),
            'type' => $this->type,
            'format' => $this->format ?: 'inline',
            'code' => $this->type === 'custom_code' ? (string) $this->code : '',
            'adsense_slot' => (string) $this->adsense_slot,
            'adsense_format' => $this->adsense_format ?: 'auto',
            'image_url' => (string) $this->banner_image_url,
            'target_url' => (string) $this->banner_target_url,
            'post_interval' => max(1, (int) $this->post_interval),
            'delay_seconds' => (int) $this->delay_seconds,
            'frequency_hours' => (int) $this->frequency_hours,
            'desktop' => (bool) $this->desktop_visible,
            'mobile' => (bool) $this->mobile_visible,
            'hide_for_members' => (bool) $this->hide_for_members,
        ];
    }
}
