<?php

namespace Framio\SeoPack\Api\Controller;

use Flarum\Http\RequestUtil;
use Framio\SeoPack\Support\SeoSettings;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * "Arama Görünümü & Site Bağlantıları" sekmesi: bölümleri (etiketler), her birinin Google'da görünecek
 * başlık/açıklamasını ve aynı başlığı paylaşan bölümleri (ör. Güncel / Arşiv) döndürür.
 */
class SearchAppearanceController implements RequestHandlerInterface
{
    public function __construct(protected SeoSettings $seo)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        $site = $this->seo->siteName();
        $suffix = trim($this->seo->get('title_suffix')) ?: (string) $this->seo->core('forum_title', $site);
        $template = trim($this->seo->get('tag_title_template'));
        $overrides = $this->seo->tagOverrides();
        $featured = $this->seo->featuredSections();

        $sections = [];
        if (class_exists(\Flarum\Tags\Tag::class)) {
            $tags = \Flarum\Tags\Tag::with('parent')->orderBy('position')->get();
            foreach ($tags as $tag) {
                $vars = ['tag' => $tag->name, 'parent' => $this->seo->sectionLabel($tag->parent), 'site_name' => $site];
                $ov = $overrides[$tag->slug] ?? [];
                $title = trim((string) ($ov['title'] ?? '')) ?: $template;
                $title = $title !== '' ? trim(SeoSettings::fill($title, $vars)) : $tag->name;
                $title = trim(preg_replace('/\s*[-–|·]\s*$/u', '', $title)) ?: $tag->name;
                $desc = trim(SeoSettings::fill((string) ($ov['description'] ?? ''), $vars)) ?: trim(strip_tags((string) $tag->description));

                $sections[] = [
                    'id' => $tag->id,
                    'slug' => $tag->slug,
                    'name' => $tag->name,
                    'parent' => $tag->parent->name ?? null,
                    'parent_id' => $tag->parent_id,
                    'hidden' => (bool) $tag->is_hidden,
                    'restricted' => (bool) $tag->is_restricted,
                    'discussions' => (int) $tag->discussion_count,
                    'url' => $this->seo->baseUrl() . '/t/' . $tag->slug,
                    'parent_slug' => $tag->parent->slug ?? null,
                    'override_short' => (string) ($ov['short'] ?? ''),
                    'override_title' => (string) ($ov['title'] ?? ''),
                    'override_description' => (string) ($ov['description'] ?? ''),
                    'tag_description' => trim(strip_tags((string) $tag->description)),
                    'page_title' => $title,
                    'full_title' => $title . ' - ' . $suffix,
                    'description' => $desc,
                    'featured' => in_array($tag->slug, $featured, true),
                ];
            }
        }

        // Aynı tam başlığı paylaşan bölümler: Google bunları ayırt edemez
        $counts = array_count_values(array_map(fn ($s) => mb_strtolower($s['full_title']), $sections));
        foreach ($sections as &$s) {
            $s['duplicate'] = ($counts[mb_strtolower($s['full_title'])] ?? 0) > 1;
            $s['too_long'] = mb_strlen($s['full_title']) > 60;
            $s['desc_short'] = mb_strlen($s['description']) < 70;
        }
        unset($s);

        $home = [
            'title' => (string) $this->seo->core('forum_title', $site),
            'description' => trim((string) ($this->seo->core('forum_description') ?: $this->seo->get('meta_description_prefix'))),
            'url' => $this->seo->baseUrl() . '/',
            'logo' => $this->seo->logoUrl(),
            'site_name' => $site,
            'alternate_names' => $this->seo->alternateNames(),
            'suffix' => $suffix,
            'social' => $this->seo->socialLinks(),
        ];

        return new JsonResponse(['home' => $home, 'sections' => $sections, 'featured' => $featured]);
    }
}
