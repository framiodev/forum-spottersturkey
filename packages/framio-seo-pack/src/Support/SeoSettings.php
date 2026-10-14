<?php

namespace Framio\SeoPack\Support;

use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;

/**
 * Eklentinin tüm ayarlarına tek giriş noktası.
 *
 * Kodun hiçbir yerinde siteye özel bir değer (alan adı, marka adı, görsel
 * sunucusu, BBCode etiketi, tablo adı…) sabit yazılmaz; hepsi buradaki
 * anahtarlarla admin panelinden yönetilir. Boş bırakılan ayarlar forumun
 * kendi çekirdek ayarlarından (forum_title, logo_path, forum URL'i) türetilir.
 */
class SeoSettings
{
    public const PREFIX = 'framio-seo.';

    /**
     * Anahtar => varsayılan değer. Admin panelinin gösterdiği varsayılanlar
     * da bu listeyle aynı tutulmalıdır.
     */
    public const DEFAULTS = [
        // Kimlik
        'org_name' => '',
        'org_logo' => '',
        'default_author' => '',
        'breadcrumb_home_label' => 'Ana Sayfa',
        'license_url' => '',
        'acquire_license_url' => '',
        'social_instagram' => '',
        'social_twitter' => '',
        'social_facebook' => '',
        'social_youtube' => '',
        'social_tiktok' => '',
        'social_linkedin' => '',

        // Google / ölçüm
        'ga_id' => '',
        'ga_id_number' => '',
        'gsc_code' => '',
        'gsc_property_url' => '',
        'gsc_image_property_url' => '',
        'ads_client' => '',
        // Reklam / gelir
        'ads_enabled' => '0',
        'ads_auto_ads' => '0',
        'ads_hide_members' => '0',
        'ads_label' => 'Reklam',
        'ads_txt_extra' => '',
        'google_client_id' => '',
        'google_client_secret' => '',
        'google_tokens' => '',
        'looker_studio_url' => '',

        // Başlık ve açıklama şablonları
        'title_format' => '{title}',
        // Arama görünümü (site adı, alternatif adlar, başlık soneki, bölüm başlıkları)
        'site_alternate_names' => '',
        'title_suffix' => '',
        'tag_title_template' => '',
        'tag_seo_overrides' => '',
        'featured_sections' => '',
        'meta_desc_format' => '',
        'meta_description_prefix' => '',
        'meta_keywords' => '',
        'image_caption_format' => '{alt}',
        'alt_text_format' => '{kunye}',
        'enable_auto_alt' => '1',
        'image_keywords' => '',
        'niche_mode' => 'general',
        'known_brands' => '',
        'enable_dynamic_og' => '1',
        'dedupe_titles' => '1',

        // Medya
        'recognized_bbcode_tags' => 'framio-image,upl-image-preview',
        'media_table' => 'framio_media_images',
        'image_proxy_rules' => '',
        'image_proxy_path' => '/f/',
        'sitemap_image_quality' => 'thumb',
        'max_schema_images' => '20',
        'brand_models_setting' => 'framio-upload-exif.brand_models',

        // Dizine ekleme
        'enable_sitemap' => '1',
        'enable_image_sitemap' => '1',
        'enable_indexnow' => '1',
        'robots_extra' => '',
        'profile_min_posts' => '1',
        'enable_hubs' => '1',
        'hub_min_posts' => '2',
        'hub_min_posts_plate' => '1',
        'enable_post_pages' => '1',
        'post_sitemap_scope' => 'media',
        'post_title_format' => '{kunye}',
        'post_show_exif' => '1',
        'post_show_location' => '0',
        'enable_redirects' => '1',
        'enable_404_log' => '1',
        'legacy_url_patterns' => '',
        'enable_indexing_api' => '0',
        'indexnow_key' => '',
        'trigger_secret' => '',
        'cron_batch_index' => '0',
        'last_batch_index' => '0',
    ];

    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected UrlGenerator $url
    ) {
    }

    public function get(string $key, ?string $default = null): string
    {
        $value = $this->settings->get(self::PREFIX . $key);

        if ($value === null || $value === '') {
            return (string) ($default ?? self::DEFAULTS[$key] ?? '');
        }

        // Adres ayarları göreli girilebilir ("/p/2-lisans"): sitenin kendi
        // adresine göre tamamlanır, alan adı değişince (test → canlı) bozulmaz.
        if (in_array($key, self::URL_KEYS, true) && str_starts_with((string) $value, '/') && !str_starts_with((string) $value, '//')) {
            return $this->baseUrl() . $value;
        }

        return (string) $value;
    }

    /** Göreli değer alabilen adres ayarları */
    public const URL_KEYS = ['license_url', 'acquire_license_url', 'org_logo', 'gsc_property_url'];

    public function bool(string $key): bool
    {
        return $this->get($key) === '1';
    }

    public function int(string $key): int
    {
        return (int) $this->get($key);
    }

    public function set(string $key, ?string $value): void
    {
        $this->settings->set(self::PREFIX . $key, $value);
    }

    public function delete(string $key): void
    {
        $this->settings->delete(self::PREFIX . $key);
    }

    /** Flarum çekirdek ayarı (forum_title, logo_path…) */
    public function core(string $key, string $default = ''): string
    {
        return (string) ($this->settings->get($key) ?: $default);
    }

    public function baseUrl(): string
    {
        return rtrim($this->url->to('forum')->base(), '/');
    }

    public function host(): string
    {
        return (string) parse_url($this->baseUrl(), PHP_URL_HOST);
    }

    /**
     * Bir tartışmanın (veya içindeki bir mesajın) kanonik sayfa adresi.
     * Mesaj numarası yerine çekirdeğin ?page=P biçimi kullanılır.
     */
    public function discussionUrl($discussion, int $postNumber = 1): string
    {
        $page = 1 + intdiv(max(0, $postNumber - 1), 20);

        return $this->baseUrl() . '/d/' . $discussion->id . ($discussion->slug ? '-' . $discussion->slug : '')
            . ($page > 1 ? '?page=' . $page : '');
    }

    public function siteName(): string
    {
        return $this->get('org_name') ?: $this->core('forum_title', $this->host());
    }

    public function logoUrl(): string
    {
        if ($logo = $this->get('org_logo')) {
            return $logo;
        }

        $path = $this->core('logo_path');

        return $path ? $this->baseUrl() . '/assets/' . $path : '';
    }

    /** @return string[] Site adının arama motorlarına bildirilecek diğer yazımları (ör. kısaltma) */
    public function alternateNames(): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/[\n,]+/', $this->get('site_alternate_names')) ?: [])));
    }

    /** @return array<string, array{title?: string, description?: string}> Bölüm (etiket) bazında başlık/açıklama */
    public function tagOverrides(): array
    {
        $data = json_decode($this->get('tag_seo_overrides') ?: '[]', true);

        return is_array($data) ? $data : [];
    }

    /** Şablondaki {parent} için bölümün kısa adı (admin'de tanımlıysa), yoksa kendi adı */
    public function sectionLabel($tag): string
    {
        if (!$tag) return '';

        return trim((string) ($this->tagOverrides()[$tag->slug]['short'] ?? '')) ?: (string) $tag->name;
    }

    /** @return string[] Öne çıkarılacak bölümlerin kısa adları (sırayla) */
    public function featuredSections(): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/[\n,]+/', $this->get('featured_sections')) ?: [])));
    }

    public function defaultAuthor(): string
    {
        return $this->get('default_author') ?: $this->siteName();
    }

    public function gscProperty(): string
    {
        return $this->get('gsc_property_url') ?: $this->baseUrl() . '/';
    }

    /** @return string[] */
    public function socialLinks(): array
    {
        $links = [];
        foreach (['instagram', 'twitter', 'facebook', 'youtube', 'tiktok', 'linkedin'] as $network) {
            if ($link = trim($this->get('social_' . $network))) {
                $links[] = $link;
            }
        }

        return $links;
    }

    /**
     * Tanınan medya BBCode etiketleri. Hem virgüllü metin hem JSON dizi
     * olarak kaydedilmiş değerleri kabul eder.
     *
     * @return string[]
     */
    public function recognizedTags(): array
    {
        // SEO Pack'in kendi listesi + Upload & EXIF'in etkin ve tanınan etiketleri (asıl kaynak).
        // Site bazında farklı etiketler (spotter-image, ulasimarsiv-image…) ayrıca girilmeden tanınır.
        $tags = array_merge(
            self::parseList($this->get('recognized_bbcode_tags')),
            self::parseList($this->core('framio-upload-exif.active_bbcode_tag')),
            self::parseList($this->core('framio-upload-exif.recognized_bbcode_tags'))
        );

        return array_values(array_unique(array_filter(array_map(fn ($t) => strtolower(trim($t, " []<>")), $tags))));
    }

    /** @return string[] */
    public function knownBrands(): array
    {
        return self::parseList($this->get('known_brands'));
    }

    /**
     * "cdn-host|/yol/öneki" satırlarından oluşan proxy kuralları.
     *
     * @return array<string,string> host => path prefix
     */
    public function imageProxyRules(): array
    {
        $rules = [];
        foreach (preg_split('/\R/', $this->get('image_proxy_rules')) as $line) {
            $parts = array_map('trim', explode('|', $line, 2));
            if (!empty($parts[0])) {
                $rules[strtolower($parts[0])] = $parts[1] ?? '/';
            }
        }

        return $rules;
    }

    public function mediaTable(): string
    {
        $table = preg_replace('/[^A-Za-z0-9_]/', '', $this->get('media_table'));

        // Eski kurulumlardaki tablo adları (spotter_images vb.): tablo yoksa ya da EXIF sütunu taşımıyorsa
        // Upload & EXIF'in güncel tablosuna düşülür (görseller oraya aktarıldı).
        static $resolved = [];
        if (!isset($resolved[$table])) {
            $resolved[$table] = $table;
            try {
                $schema = resolve('db')->getSchemaBuilder();
                if ($table === '' || !$schema->hasTable($table) || !$schema->hasColumn($table, 'exif_data')) {
                    $resolved[$table] = $schema->hasTable('framio_media_images') ? 'framio_media_images' : $table;
                }
            } catch (\Throwable $e) {
            }
        }

        return $resolved[$table];
    }

    /** @return array[] Upload & EXIF eklentisinin marka/model kuralları */
    public function brandModelRules(): array
    {
        $key = $this->get('brand_models_setting');
        $raw = $key ? $this->settings->get($key) : null;
        $rules = $raw ? json_decode($raw, true) : null;

        return is_array($rules) ? array_values(array_filter($rules, 'is_array')) : [];
    }

    /** @return string[] */
    public static function parseList(string $value): array
    {
        $value = trim($value);
        if ($value === '') {
            return [];
        }

        $decoded = str_starts_with($value, '[') ? json_decode($value, true) : null;
        $items = is_array($decoded) ? $decoded : preg_split('/[,\n]/', $value);

        return array_values(array_unique(array_filter(array_map(fn ($i) => trim((string) $i), $items))));
    }

    /**
     * {yer_tutucu} şablonunu doldurur, boş kalan yer tutucuların
     * etrafındaki ayırıcıları temizler.
     */
    public static function fill(string $template, array $vars): string
    {
        $out = preg_replace_callback('/\{([a-z_]+)\}/', fn ($m) => (string) ($vars[$m[1]] ?? ''), $template);

        // Boş yer tutucudan kalan "|  -", "( )", çift boşluk gibi artıkları temizle
        $out = preg_replace('/\(\s*\)/u', '', $out);
        $out = preg_replace('/\s*([|\-–—:,])\s*(?=[|\-–—:,]|$)/u', '', $out);
        $out = preg_replace('/^\s*[|\-–—:,]\s*/u', '', $out);
        $out = preg_replace('/\s{2,}/u', ' ', $out);

        return trim($out);
    }
}
