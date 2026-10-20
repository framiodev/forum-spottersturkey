<?php

namespace Framio\SocialShare\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Throwable;

class ForumFeedPostsController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        try {
            $actor = RequestUtil::getActor($request);
            $actor->assertRegistered();

            $params = $request->getQueryParams();
            $query = trim($params['q'] ?? '');
            $limit = min(max((int)($params['limit'] ?? 20), 1), 50);
            $offset = max((int)($params['offset'] ?? 0), 0);

            $db = resolve('flarum.db');

            // Görsel içeren veya spotter bbcode'u olan gönderileri ve konu/yazar bilgilerini çekelim
            $builder = $db->table('posts')
                ->join('discussions', 'posts.discussion_id', '=', 'discussions.id')
                ->leftJoin('users', 'posts.user_id', '=', 'users.id')
                ->select([
                    'posts.id as post_id',
                    'posts.discussion_id',
                    'posts.user_id',
                    'posts.content',
                    'posts.created_at as post_created_at',
                    'posts.number as post_number',
                    'discussions.title as discussion_title',
                    'discussions.slug as discussion_slug',
                    'users.username',
                    'users.nickname',
                    'users.avatar_url'
                ])
                ->where('posts.type', '=', 'comment')
                ->whereNull('posts.hidden_at')
                ->where(function ($q) {
                    $q->where('posts.content', 'like', '%<img%')
                      ->orWhere('posts.content', 'like', '%[framio-image%')->orWhere('posts.content', 'like', '%-image id=%')
                      ->orWhere('posts.content', 'like', '%http%');
                })
                ->orderBy('posts.id', 'desc');

            if (!empty($query)) {
                $builder->where(function ($q) use ($query) {
                    $q->where('discussions.title', 'like', "%{$query}%")
                      ->orWhere('users.username', 'like', "%{$query}%")
                      ->orWhere('users.nickname', 'like', "%{$query}%")
                      ->orWhere('posts.content', 'like', "%{$query}%");
                });
            }

            // Sayfalamada yeterli görsel içeren gönderi bulabilmek için biraz daha geniş çekip filtreleyelim
            $rawPosts = $builder->limit($limit * 3)->offset($offset)->get();

            $formattedPosts = [];

            foreach ($rawPosts as $post) {
                $content = (string) $post->content;
                $images = [];

                // 1. HTML <img> etiketleri
                if (preg_match_all('/<img[^>]+src=["\']?([^"\'>\s]+)["\']?/i', $content, $matches)) {
                    foreach ($matches[1] as $src) {
                        // Emoji veya küçük ikonları hariç tut
                        if (stripos($src, 'emoji') === false && stripos($src, 'avatar') === false) {
                            $images[] = $src;
                        }
                    }
                }

                // 2. [ulasimarsiv-image id=... url="..." alt="..."] BBCode / Format
                if (preg_match_all('/url=["\']([^"\']+)["\']/i', $content, $matches)) {
                    foreach ($matches[1] as $url) {
                        if (!in_array($url, $images) && (stripos($url, '.jpg') !== false || stripos($url, '.png') !== false || stripos($url, '.webp') !== false || stripos($url, '.jpeg') !== false)) {
                            $images[] = $url;
                        }
                    }
                }

                // 3. Düz Firebase veya görsel URL'leri
                if (preg_match_all('/https?:\/\/[^\s<>"\'\)]+\.(?:jpg|jpeg|png|webp)/i', $content, $matches)) {
                    foreach ($matches[0] as $url) {
                        if (!in_array($url, $images)) {
                            $images[] = $url;
                        }
                    }
                }

                // Benzersiz yap
                $images = array_values(array_unique($images));

                if (empty($images)) {
                    continue;
                }

                // Gönderi düz metin özeti (HTML etiketleri ve bbcode temizliği)
                $plainSnippet = strip_tags(preg_replace('/\[[^\]]+\]/', '', $content));
                $plainSnippet = preg_replace('/\s+/', ' ', $plainSnippet);
                $plainSnippet = trim(mb_substr($plainSnippet, 0, 160));

                $formattedPosts[] = [
                    'post_id' => $post->post_id,
                    'discussion_id' => $post->discussion_id,
                    'discussion_title' => $post->discussion_title,
                    'post_number' => $post->post_number,
                    'author_name' => $post->nickname ?: $post->username ?: 'Bilinmiyor',
                    'username' => $post->username,
                    'avatar_url' => $post->avatar_url,
                    'created_at' => $post->post_created_at,
                    'snippet' => $plainSnippet,
                    'images' => $images
                ];

                if (count($formattedPosts) >= $limit) {
                    break;
                }
            }

            return new JsonResponse([
                'success' => true,
                'posts' => $formattedPosts,
                'count' => count($formattedPosts)
            ]);

        } catch (Throwable $e) {
            return new JsonResponse([
                'error' => 'Forum gönderileri alınamadı: ' . $e->getMessage()
            ], 500);
        }
    }
}
