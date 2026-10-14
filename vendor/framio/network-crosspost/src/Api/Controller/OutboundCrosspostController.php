<?php

namespace Framio\NetworkCrosspost\Api\Controller;

use Flarum\Discussion\Discussion;
use Flarum\Http\RequestUtil;
use Flarum\Http\UrlGenerator;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class OutboundCrosspostController implements RequestHandlerInterface
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected UrlGenerator $url,
        protected ConnectionInterface $db
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        if ($actor->isGuest()) {
            return new JsonResponse(['error' => 'Bu işlem için giriş yapmalısınız.'], 401);
        }

        $body = (array) $request->getParsedBody();
        $postId = (int) Arr::get($body, 'post_id', 0);
        $discussionId = (int) Arr::get($body, 'discussion_id', 0);
        $selectedNodes = (array) Arr::get($body, 'target_nodes', []);
        $targetTags = (array) Arr::get($body, 'target_tags', []);
        $targetDiscussionUrls = (array) Arr::get($body, 'target_discussion_urls', []);
        $customTitle = trim((string) Arr::get($body, 'custom_title', ''));
        $customDescription = trim((string) Arr::get($body, 'custom_description', ''));
        $watermarkMode = (string) Arr::get($body, 'watermark_mode', 'keep_source');
        $watermarkId = Arr::get($body, 'watermark_id', null);
        $customWatermark = Arr::get($body, 'custom_watermark', null);
        $targetUsernames = (array) Arr::get($body, 'target_usernames', []);
        $targetUserIds = (array) Arr::get($body, 'target_user_ids', []);
        // Birden çok görselli mesajda sıralama ve aktarılmayacak görseller
        $orderedImageUrls = array_values(array_filter(array_map('strval', (array) Arr::get($body, 'ordered_image_urls', []))));
        $orderedImageIds = array_map('intval', (array) Arr::get($body, 'ordered_image_ids', []));
        $excludedIds = array_map('intval', (array) Arr::get($body, 'excluded_image_ids', []));
        $excludedUrls = array_filter(array_map('strval', (array) Arr::get($body, 'excluded_image_urls', [])));

        if (empty($selectedNodes)) {
            return new JsonResponse([
                'error' => 'En az bir hedef ağ platformu seçilmelidir.'
            ], 422);
        }

        $targetPost = null;
        $discussion = null;

        if ($postId > 0) {
            $targetPost = Post::find($postId);
            if ($targetPost) {
                $discussion = $targetPost->discussion;
            }
        } elseif ($discussionId > 0) {
            $discussion = Discussion::find($discussionId);
            if ($discussion) {
                $targetPost = $discussion->firstPost ?: $discussion->posts()->orderBy('id', 'asc')->first();
            }
        }

        if (!$discussion || !$targetPost) {
            return new JsonResponse(['error' => 'Aktarılacak içerik veya tartışma bulunamadı.'], 404);
        }

        // Yetki Kontrolü
        if (!$actor->isAdmin() && !$actor->hasPermission('discussion.crosspost')) {
            return new JsonResponse(['error' => 'Bu içeriği ağa aktarma yetkiniz bulunmuyor.'], 403);
        }

        // Kayıtlı Ağ Düğümlerini Çek
        $rawNodes = $this->settings->get('framio-network-crosspost.nodes', '[]');
        $allNodes = json_decode($rawNodes, true);
        if (!is_array($allNodes)) {
            $allNodes = [];
        }

        $currentPlatformName = (string) $this->settings->get('framio-network-crosspost.current_platform_name', 'Flarum Forum');
        $currentForumUrl = rtrim($this->url->to('forum')->base(), '/');
        
        $postUrl = $this->url->to('forum')->route('discussion', [
            'id' => $discussion->id . ($discussion->slug ? '-' . $discussion->slug : ''),
            'near' => $targetPost->number
        ]);

        // Yazar bilgileri (Mesajın gerçek yazarı)
        $authorUser = $targetPost->user ?: $discussion->user;
        $authorName = $authorUser ? ($authorUser->display_name ?: $authorUser->username) : 'Anonim';
        $authorProfileUrl = $authorUser ? $this->url->to('forum')->route('user', ['username' => $authorUser->username]) : null;

        // Görselleri mutlak URL'ye çevir
        $postContent = $targetPost->content;
        if ($excludedIds || $excludedUrls) {
            $postContent = self::removeImages($postContent, $excludedIds, $excludedUrls);
        }
        $postContent = preg_replace(
            '/\!\[(.*?)\]\(\/assets\/files\/(.*?)\)/i',
            '![$1](' . $currentForumUrl . '/assets/files/$2)',
            $postContent
        );
        $postContent = preg_replace(
            '/src=[\'"]\/assets\/files\/(.*?)[\'"]/i',
            'src="' . $currentForumUrl . '/assets/files/$1"',
            $postContent
        );

        // Ekli görsellerin (EXIF verileri dahil) toplanması
        $attachments = [];
        $imageIds = [];

        if (preg_match_all('/\[(?:spotter-image|ulasimarsiv-image|framio-image)[^\]]*\bid=[\'"]?(\d+)[\'"]?[^\]]*\]/i', $postContent, $idMatches)) {
            $imageIds = array_unique(array_map('intval', $idMatches[1]));
        }

        if (!empty($imageIds)) {
            $dbImages = collect();
            try {
                // 1. framio_media_images tablosunu sorgula (EXIF verilerini içerir)
                $dbImages = $this->db->table('framio_media_images')
                    ->whereIn('id', $imageIds)
                    ->get();
            } catch (\Throwable $e) {
            }

            if ($dbImages->isEmpty()) {
                try {
                    // 2. spotter_images tablosunu dene
                    $dbImages = $this->db->table('spotter_images')
                        ->whereIn('id', $imageIds)
                        ->get();
                } catch (\Throwable $e) {
                }
            }

            foreach ($dbImages as $img) {
                $attachments[] = [
                    'original_id' => $img->id,
                    'filename' => $img->filename ?? '',
                    'path' => $img->path ?? '',
                    'thumb_path' => $img->thumb_path ?? '',
                    'original_path' => $img->original_path ?? null,
                    'exif_data' => $img->exif_data ?? null,
                    'kunye' => $img->kunye ?? null,
                    'music_data' => $img->music_data ?? null,
                    'title' => $img->title ?? null,
                    'description' => $img->description ?? null,
                ];
            }
        }

        // [framio-image ...] ve [upl-image-preview ...] etiketlerini Markdown formatına dönüştür ve eksikse attachments'a ekle
        $postContent = preg_replace_callback(
            '/\[(?:framio-image|upl-image-preview|spotter-image|ulasimarsiv-image)[^\]]*\]/i',
            function ($matches) use (&$attachments) {
                $tag = $matches[0];
                $url = '';
                $alt = '';
                $id = 0;

                if (preg_match('/\bid=[\'"]?(\d+)[\'"]?/i', $tag, $m)) {
                    $id = (int)$m[1];
                }
                if (preg_match('/\burl=["\']([^"\']+)["\']/i', $tag, $m)) {
                    $url = $m[1];
                } elseif (preg_match('/\burl=([^\s\]]+)/i', $tag, $m)) {
                    $url = $m[1];
                }

                if (preg_match('/\balt=["\']([^"\']*)["\']/i', $tag, $m)) {
                    $alt = $m[1];
                }

                if (!empty($url)) {
                    // Eğer bu ID veya URL henüz attachments içinde yoksa ekle
                    $alreadyExists = false;
                    foreach ($attachments as $att) {
                        if (($id > 0 && ($att['original_id'] ?? 0) === $id) || ($att['path'] ?? '') === $url || ($att['thumb_path'] ?? '') === $url) {
                            $alreadyExists = true;
                            break;
                        }
                    }

                    if (!$alreadyExists) {
                        $attachments[] = [
                            'original_id' => $id,
                            'filename' => basename(parse_url($url, PHP_URL_PATH) ?: 'image.webp'),
                            'path' => $url,
                            'thumb_path' => $url,
                            'original_path' => $url,
                            'alt' => $alt,
                        ];
                    }

                    $cleanUrl = str_replace([' ', '(', ')'], ['%20', '%28', '%29'], $url);
                    return '![' . $alt . '](' . $cleanUrl . ')';
                }

                return $tag;
            },
            $postContent
        );

        // Hariç tutulan görselleri attachments listesinden temizle
        if (!empty($excludedIds) || !empty($excludedUrls)) {
            $attachments = array_values(array_filter($attachments, function ($att) use ($excludedIds, $excludedUrls) {
                $aId = (int) ($att['original_id'] ?? 0);
                if ($aId > 0 && in_array($aId, $excludedIds, true)) {
                    return false;
                }
                $aPath = (string) ($att['path'] ?? '');
                $aOrig = (string) ($att['original_path'] ?? '');
                foreach ($excludedUrls as $eUrl) {
                    if ($aPath === $eUrl || $aOrig === $eUrl || ($aPath && str_ends_with($eUrl, basename($aPath)))) {
                        return false;
                    }
                }
                return true;
            }));
        }

        // Kullanıcının belirlediği görsel sırasına (özellikle kapak fotoğrafı seçimine) göre attachments listesini sırala
        if (!empty($orderedImageUrls) || !empty($orderedImageIds)) {
            usort($attachments, function ($a, $b) use ($orderedImageUrls, $orderedImageIds) {
                $calcWeight = function ($item) use ($orderedImageUrls, $orderedImageIds) {
                    $itemId = (int) ($item['original_id'] ?? 0);
                    $path = (string) ($item['path'] ?? '');
                    $orig = (string) ($item['original_path'] ?? '');
                    $thumb = (string) ($item['thumb_path'] ?? '');

                    foreach ($orderedImageUrls as $idx => $url) {
                        if ($url === $path || $url === $orig || $url === $thumb) {
                            return $idx;
                        }
                        if ($path && str_ends_with($url, basename($path))) {
                            return $idx;
                        }
                    }

                    if ($itemId > 0 && !empty($orderedImageIds)) {
                        $idIdx = array_search($itemId, $orderedImageIds, true);
                        if ($idIdx !== false) {
                            return $idIdx;
                        }
                    }

                    return 9999;
                };

                return $calcWeight($a) <=> $calcWeight($b);
            });
        }

        $client = new Client([
            'timeout' => 300.0, // alıcı taraf her görseli indirip imzalayıp buluta yüklüyor
            'connect_timeout' => 15.0,
            'http_errors' => false,
            'verify' => false
        ]);

        $results = [];
        $uniqueSyncKey = 'crosspost_p' . $targetPost->id . '_' . md5($currentForumUrl . '_' . $targetPost->id);

        $finalTitle = !empty($customTitle) ? $customTitle : $discussion->title;

        foreach ($allNodes as $index => $node) {
            $nodeId = Arr::get($node, 'id', (string) $index);
            if (!in_array($nodeId, $selectedNodes) && !in_array(Arr::get($node, 'name'), $selectedNodes)) {
                continue;
            }

            $nodeName = Arr::get($node, 'name', 'Bilinmeyen Forum');
            $nodeBaseUrl = rtrim((string) Arr::get($node, 'url', ''), '/');
            $nodeSecret = trim((string) Arr::get($node, 'secret_key', ''));
            $nodeTagSlug = Arr::get($targetTags, $nodeId, Arr::get($node, 'default_tag_slug', ''));
            $nodeTargetDiscussion = trim((string) Arr::get($targetDiscussionUrls, $nodeId, ''));

            if (empty($nodeBaseUrl) || empty($nodeSecret)) {
                $results[] = [
                    'node' => $nodeName,
                    'success' => false,
                    'error' => 'Bu ağ düğümünün URL veya Güvenlik Anahtarı tanımlı değil.'
                ];
                continue;
            }

            $targetEndpoint = $nodeBaseUrl . '/api/framio/crosspost/inbound';

            $nodeTargetUsername = trim((string) Arr::get($targetUsernames, $nodeId, ''));
            $nodeTargetUserId = Arr::get($targetUserIds, $nodeId, null);

            $payload = [
                'source' => [
                    'platform' => $currentPlatformName,
                    'url' => $currentForumUrl,
                    'post_url' => $postUrl,
                    'sync_key' => $uniqueSyncKey,
                ],
                'author' => [
                    'name' => $authorName,
                    'username' => $authorUser?->username,
                    'avatar_url' => $authorUser?->avatar_url,
                    'profile_url' => $authorProfileUrl,
                ],
                'target_username' => !empty($nodeTargetUsername) ? $nodeTargetUsername : ($authorUser?->username),
                'target_user_id' => $nodeTargetUserId,
                'content' => [
                    'title' => $finalTitle,
                    'body' => $postContent,
                    'description' => $customDescription,
                ],
                'custom_description' => $customDescription,
                'attachments' => $attachments,
                'watermark' => [
                    'mode' => $watermarkMode,
                    'id' => $watermarkId,
                    'custom' => $customWatermark,
                    'username' => !empty($nodeTargetUsername) ? $nodeTargetUsername : ($authorUser?->username),
                ],
                'target_tag_slug' => $nodeTagSlug,
                'target_discussion_url' => $nodeTargetDiscussion
            ];

            try {
                $response = $client->post($targetEndpoint, [
                    'headers' => [
                        'X-Crosspost-Secret' => $nodeSecret,
                        'Accept' => 'application/json',
                    ],
                    'json' => $payload
                ]);

                $statusCode = $response->getStatusCode();
                $respBody = json_decode((string) $response->getBody(), true);

                if ($statusCode >= 200 && $statusCode < 300 && Arr::get($respBody, 'success')) {
                    $results[] = [
                        'node' => $nodeName,
                        'success' => true,
                        'duplicate' => Arr::get($respBody, 'duplicate', false),
                        'url' => Arr::get($respBody, 'url', ''),
                        'message' => Arr::get($respBody, 'message', 'Başarıyla aktarıldı.')
                    ];
                } else {
                    $results[] = [
                        'node' => $nodeName,
                        'success' => false,
                        'error' => Arr::get($respBody, 'error', 'Sunucudan ' . $statusCode . ' durum kodu alındı.')
                    ];
                }
            } catch (GuzzleException $e) {
                $results[] = [
                    'node' => $nodeName,
                    'success' => false,
                    'error' => 'Bağlantı hatası: ' . $e->getMessage()
                ];
            }
        }

        return new JsonResponse([
            'success' => true,
            'results' => $results
        ]);
    }

    /**
     * Seçilmeyen görsel etiketlerini (ve hemen ardından gelen künye bloğunu) içerikten çıkarır.
     * Desteklenen biçimler: [spotter-image ...](...[/spotter-image]), [ulasimarsiv-image ...],
     * [upl-image-preview ...] ve ![alt](url).
     */
    public static function removeImages(string $content, array $ids, array $urls): string
    {
        $matches = function (string $tag) use ($ids, $urls): bool {
            if ($ids && preg_match('/\bid=[\'"]?(\d+)/i', $tag, $m) && in_array((int) $m[1], $ids, true)) {
                return true;
            }
            foreach ($urls as $u) {
                if ($u !== '' && str_contains($tag, $u)) {
                    return true;
                }
            }
            return false;
        };
        $kunye = '(?:\s*\[framio-kunye[^\]]*\].*?\[\/framio-kunye\])?';

        $content = preg_replace_callback(
            '/\[(spotter-image|ulasimarsiv-image|upl-image-preview)\b[^\]]*\](?:.*?\[\/\])?' . $kunye . '/is',
            fn ($m) => $matches($m[0]) ? '' : $m[0],
            $content
        );
        $content = preg_replace_callback(
            '/!\[[^\]]*\]\([^)]+\)' . $kunye . '/is',
            fn ($m) => $matches($m[0]) ? '' : $m[0],
            $content
        );

        return trim(preg_replace("/\n{3,}/", "\n\n", $content));
    }
}