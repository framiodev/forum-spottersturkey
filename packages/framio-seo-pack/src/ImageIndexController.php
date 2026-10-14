<?php

namespace Framio\SeoPack;

use Flarum\Post\Post;
use Flarum\Http\UrlGenerator;
use Illuminate\Database\ConnectionInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Illuminate\Support\Arr;

class ImageIndexController implements RequestHandlerInterface
{
    protected $settings;
    protected $url;
    protected $db;

    public function __construct(SettingsRepositoryInterface $settings, UrlGenerator $url, ConnectionInterface $db)
    {
        $this->settings = $settings;
        $this->url = $url;
        $this->db = $db;
    }

    public function handle(Request $request): Response
    {
        \Flarum\Http\RequestUtil::getActor($request)->assertAdmin();

        try {
            $params = $request->getQueryParams();
            $debug  = Arr::get($params, 'debug', false);
            $limit  = 100;
            $page   = (int) Arr::get($params, 'page', 1);
            $offset = ($page - 1) * $limit;

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

            $seo = resolve(\Framio\SeoPack\Support\SeoSettings::class);
            $recognizedTags = $seo->recognizedTags();

            // TÜM postları tara
            $posts = Post::with(['user', 'discussion'])
                ->orderBy('id', 'desc')
                ->get();

            $baseUrl = rtrim($this->url->to('forum')->base(), '/');
            $tableName = $seo->mediaTable();
            if (!$tableName || !$this->db->getSchemaBuilder()->hasTable($tableName)) {
                $tableName = null;
            }

            $images = [];
            foreach ($posts as $post) {
                $rawContent = html_entity_decode($post->getRawOriginal('content') ?? '', ENT_QUOTES | ENT_XML1, 'UTF-8');
                $foundImages = \Framio\SeoPack\Helpers\MediaTagParser::extractImages($rawContent, $baseUrl, $recognizedTags);
                if (empty($foundImages)) continue;

                // Kullanıcı bilgisi
                $user = $post->user;
                $userDisplayName = $user ? ($user->display_name ?? $user->username ?? 'Bilinmiyor') : 'Bilinmiyor';

                // Konu bilgisi
                $discussion = $post->discussion;
                $discussionId    = $discussion ? $discussion->id    : null;
                $discussionTitle = $discussion ? $discussion->title : 'İsimsiz Konu';
                $discussionSlug  = $discussion ? $discussion->slug  : '';

                // Discussion URL'i
                $discussionUrl = '';
                if ($discussion) {
                    $discussionUrl = $baseUrl . '/d/' . $discussion->id . ($discussionSlug ? '-' . $discussionSlug : '');
                }

                // Marka/Model eşleştirmesi
                $matchedBrand = '';
                $matchedModel = '';
                if ($discussion && !empty($brandModelRules)) {
                    $discussionTagSlug = 'd/' . $discussion->id . ($discussionSlug ? '-' . $discussionSlug : '');

                    foreach ($brandModelRules as $rule) {
                        $ruleSlug = trim($rule['tagSlug'] ?? '');
                        if ($ruleSlug === $discussionTagSlug ||
                            (preg_match('/^d\/(\d+)/', $ruleSlug, $m) && (int)$m[1] === $discussionId)) {
                            $matchedBrand = $rule['brand'] ?? '';
                            $matchedModel = $rule['model'] ?? '';
                            break;
                        }
                    }
                }

                // Düz metin
                $postText = strip_tags(preg_replace('/\[.*?\]/s', ' ', $rawContent));
                $postText = trim(preg_replace('/\s+/', ' ', $postText));

                foreach ($foundImages as $imgItem) {
                    $id = $imgItem['id'] ?? null;
                    $url = $imgItem['url'] ?? '';
                    $alt = $imgItem['alt'] ?? '';

                    if (!$url) continue;

                    $exif = null;
                    if ($id && $tableName) {
                        $imgRec = $this->db->table($tableName)->where('id', $id)->first();
                        if ($imgRec && !empty($imgRec->exif_data)) {
                            $exif = is_string($imgRec->exif_data) ? json_decode($imgRec->exif_data, true) : $imgRec->exif_data;
                        }
                    }

                    $images[] = [
                        'post_id'             => $post->id,
                        'post_number'         => $post->number,
                        'post_url'            => $discussionUrl . ($post->number ? '/' . $post->number : ''),
                        'discussion_id'       => $discussionId,
                        'discussion_title'    => $discussionTitle,
                        'discussion_slug'     => $discussionSlug,
                        'discussion_url'      => $discussionUrl,
                        'image_id'            => $id,
                        'url'                 => $url,
                        'alt'                 => $alt ?: 'Açıklama Belirtilmedi',
                        'user_display_name'   => $userDisplayName,
                        'brand'               => $matchedBrand,
                        'model'               => $matchedModel,
                        'post_text'           => $postText,
                        'exif'                => $exif,
                    ];
                }
            }

            return new JsonResponse([
                'status' => 'success',
                'images' => $images,
                'page'   => $page,
                'count'  => count($images),
            ]);

        } catch (\Exception $e) {
            return new JsonResponse([
                'status'  => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
