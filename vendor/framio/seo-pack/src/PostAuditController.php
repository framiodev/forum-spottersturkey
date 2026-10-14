<?php

namespace Framio\SeoPack;

use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Flarum\Http\UrlGenerator;
use Illuminate\Support\Arr;
use Carbon\Carbon;

class PostAuditController implements RequestHandlerInterface
{
    protected $settings;
    protected $url;

    public function __construct(SettingsRepositoryInterface $settings, UrlGenerator $url)
    {
        $this->settings = $settings;
        $this->url = $url;
    }

    public function handle(Request $request): Response
    {
        \Flarum\Http\RequestUtil::getActor($request)->assertAdmin();

        try {
            $params = $request->getQueryParams();
            $showAll = Arr::get($params, 'showAll', 'false') === 'true';

            // Marka/Model kurallarını yükle
            $brandModelRules = [];
            try {
                $rawRules = json_encode(resolve(\Framio\SeoPack\Support\SeoSettings::class)->brandModelRules());
                if ($rawRules) {
                    $parsed = json_decode($rawRules, true);
                    if (is_array($parsed)) {
                        foreach ($parsed as $rule) {
                            if (!empty($rule['tagSlug'])) {
                                $brandModelRules[] = $rule;
                            }
                        }
                    }
                }
            } catch (\Exception $e) {
                // Brand model rules yüklenemezse devam et
            }

            // Normalde sadece görselli postları getirelim. Eğer showAll seçilirse tümünü getirebiliriz.
            $query = Post::with(['user', 'discussion']);
            
            $posts = $query->orderBy('id', 'desc')->get();
            $baseUrl = rtrim($this->url->to('forum')->base(), '/');

            $items = [];
            $stats = [
                'total' => 0,
                'with_images' => 0,
                'critical' => 0,
                'pending' => 0,
                'done' => 0,
                'skip' => 0
            ];

            $recognizedTags = resolve(\Framio\SeoPack\Support\SeoSettings::class)->recognizedTags();
            $mediaTagPattern = implode('|', array_map(fn ($t) => preg_quote(strtoupper($t), '/'), array_merge(['framio-image', 'upl-image-preview'], $recognizedTags)));

            foreach ($posts as $post) {
                $rawContent = html_entity_decode($post->getRawOriginal('content') ?? '', ENT_QUOTES | ENT_XML1, 'UTF-8');
                $foundImages = \Framio\SeoPack\Helpers\MediaTagParser::extractImages($rawContent, $baseUrl, $recognizedTags);
                $imageCount = count($foundImages);
                $hasImage = $imageCount > 0;

                if (!$showAll && !$hasImage) {
                    continue;
                }

                $firstImageUrl = $hasImage ? ($foundImages[0]['thumb_url'] ?? $foundImages[0]['url']) : '';

                $user = $post->user;
                $userDisplayName = $user ? ($user->display_name ?? $user->username) : 'Bilinmiyor';

                $discussion = $post->discussion;
                if (!$discussion) continue; // no discussion

                $discussionId    = $discussion->id;
                $discussionTitle = $discussion->title;
                $discussionSlug  = $discussion->slug;

                // Mesaj URL'si Flarum standartlarında: /d/123-slug/post_number
                $discussionUrl = $baseUrl . '/d/' . $discussionId . ($discussionSlug ? '-' . $discussionSlug : '');
                $postUrl = $discussionUrl . '/' . $post->number;

                // Marka / Model bulma
                $matchedBrand = '';
                $matchedModel = '';
                $discussionTags = $discussion->tags;
                if ($discussionTags) {
                    $dTagSlugs = $discussionTags->pluck('slug')->toArray();
                    foreach ($brandModelRules as $rule) {
                        if (in_array($rule['tagSlug'], $dTagSlugs) || (string)$discussionId === (string)($rule['discussionId'] ?? '')) {
                            $matchedBrand = $rule['brand'] ?? '';
                            $matchedModel = $rule['model'] ?? '';
                            break;
                        }
                    }
                }

                // Düz metin içeriği
                $postText = preg_replace('/<(' . $mediaTagPattern . ')\b[^>]*>.*?<\/\1>/is', ' ', $rawContent);
                $postText = strip_tags($postText);
                $postText = trim(preg_replace('/\s+/', ' ', $postText));
                if (mb_strlen($postText) > 200) {
                    $postText = mb_substr($postText, 0, 200) . '...';
                }

                // Öncelik Belirleme
                // Artık post bazında seo_last_sent_at tutuluyor.
                $seoLastSentAt = $post->seo_last_sent_at;
                
                $priority = 'skip';
                if ($hasImage) {
                    if (!$seoLastSentAt || $seoLastSentAt === '0000-00-00 00:00:00') {
                        $diffDays = $post->created_at ? Carbon::now()->diffInDays(Carbon::parse($post->created_at)) : 100;
                        if ($diffDays <= 30) {
                            $priority = 'critical';
                        } else {
                            $priority = 'pending';
                        }
                    } else {
                        // Bildirilmiş ancak post güncellenmişse pending olabilir, şimdilik done
                        $priority = 'done';
                    }
                }

                $stats['total']++;
                if ($hasImage) $stats['with_images']++;
                $stats[$priority]++;

                $items[] = [
                    'post_id'             => $post->id,
                    'post_number'         => $post->number,
                    'discussion_id'       => $discussionId,
                    'discussion_title'    => $discussionTitle,
                    'discussion_url'      => $discussionUrl,
                    'post_url'            => $postUrl,
                    'created_at'          => $post->created_at ? Carbon::parse($post->created_at)->format('Y-m-d H:i') : null,
                    'user_display_name'   => $userDisplayName,
                    'post_text'           => $postText ?: 'Metin yok',
                    'image_count'         => $imageCount,
                    'first_image_url'     => $firstImageUrl,
                    'brand'               => $matchedBrand,
                    'model'               => $matchedModel,
                    'priority'            => $priority,
                    'seo_last_sent_at'    => ($seoLastSentAt && $seoLastSentAt !== '0000-00-00 00:00:00') ? Carbon::parse($seoLastSentAt)->format('Y-m-d H:i') : null,
                ];
            }

            return new JsonResponse([
                'posts' => $items,
                'stats' => $stats
            ]);
            
        } catch (\Exception $e) {
            return new JsonResponse([
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ], 500);
        }
    }
}
