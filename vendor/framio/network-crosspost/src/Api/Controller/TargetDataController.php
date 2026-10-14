<?php

namespace Framio\NetworkCrosspost\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class TargetDataController implements RequestHandlerInterface
{
    public function __construct(
        protected SettingsRepositoryInterface $settings
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if ($actor->isGuest()) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $params = $request->getQueryParams();
        $action = $params['action'] ?? '';

        if ($action === 'watermarks') {
            return $this->watermarks($request);
        }

        if ($action === 'users') {
            return $this->users($request);
        }

        if ($action === 'categories') {
            return $this->categories($request);
        }

        return $this->discussions($request);
    }

    public function categories(ServerRequestInterface $request): ResponseInterface
    {
        $params = $request->getQueryParams();
        $nodeId = $params['node_id'] ?? '';

        $node = $this->findNode($nodeId);
        if (!$node) {
            return new JsonResponse(['error' => 'Hedef platform bulunamadı.'], 404);
        }

        $nodeUrl = rtrim($node['url'], '/');
        $client = new Client([
            'timeout' => 10.0,
            'connect_timeout' => 5.0,
            'http_errors' => false,
            'verify' => false,
        ]);

        try {
            // Önce Portfolyo kategorileri API'sini dene
            $categoriesUrl = $nodeUrl . '/api/crosspost/categories';
            $response = $client->get($categoriesUrl, [
                'headers' => [
                    'Accept' => 'application/json',
                    'User-Agent' => 'FramioCrosspost/1.0',
                ],
            ]);

            if ($response->getStatusCode() === 200) {
                $data = json_decode((string) $response->getBody(), true);
                if (!empty($data['categories']) && is_array($data['categories'])) {
                    return new JsonResponse([
                        'is_portfolio' => true,
                        'categories' => $data['categories']
                    ]);
                }
            }

            // Alternatif olarak Flarum /api/tags ucunu dene
            $tagsUrl = $nodeUrl . '/api/tags';
            $response = $client->get($tagsUrl, [
                'headers' => [
                    'Accept' => 'application/vnd.api+json, application/json',
                    'User-Agent' => 'FramioCrosspost/1.0',
                ],
            ]);

            if ($response->getStatusCode() === 200) {
                $data = json_decode((string) $response->getBody(), true);
                $tagsRaw = $data['data'] ?? [];
                $categories = [];
                foreach ($tagsRaw as $tag) {
                    $attrs = $tag['attributes'] ?? [];
                    $categories[] = [
                        'id' => (string) ($tag['id'] ?? ''),
                        'name' => $attrs['name'] ?? '',
                        'slug' => $attrs['slug'] ?? '',
                        'parentId' => null,
                    ];
                }
                return new JsonResponse([
                    'is_portfolio' => false,
                    'categories' => $categories
                ]);
            }

            return new JsonResponse(['categories' => []]);
        } catch (\Throwable $e) {
            return new JsonResponse(['categories' => [], 'error' => $e->getMessage()]);
        }
    }

    public function users(ServerRequestInterface $request): ResponseInterface
    {
        $params = $request->getQueryParams();
        $nodeId = $params['node_id'] ?? '';
        $query = trim($params['q'] ?? '');

        $node = $this->findNode($nodeId);
        if (!$node) {
            return new JsonResponse(['error' => 'Hedef platform bulunamadı.'], 404);
        }

        $nodeUrl = rtrim($node['url'], '/');
        $targetApiUrl = $nodeUrl . '/api/users';

        $client = new Client([
            'timeout' => 10.0,
            'connect_timeout' => 5.0,
            'http_errors' => false,
        ]);

        try {
            $queryParams = [
                'page[limit]' => 8,
            ];
            if (!empty($query)) {
                $queryParams['filter[q]'] = $query;
            }

            $response = $client->get($targetApiUrl, [
                'query' => $queryParams,
                'headers' => [
                    'Accept' => 'application/vnd.api+json, application/json',
                    'User-Agent' => 'FramioCrosspost/1.0',
                ],
            ]);

            if ($response->getStatusCode() !== 200) {
                return new JsonResponse(['users' => []]);
            }

            $data = json_decode((string) $response->getBody(), true);
            $usersRaw = $data['data'] ?? [];

            $users = [];
            foreach ($usersRaw as $u) {
                $attrs = $u['attributes'] ?? [];
                $users[] = [
                    'id' => $u['id'] ?? '',
                    'username' => $attrs['username'] ?? '',
                    'display_name' => $attrs['displayName'] ?? $attrs['username'] ?? '',
                    'avatar_url' => $attrs['avatarUrl'] ?? null,
                ];
            }

            return new JsonResponse(['users' => $users]);
        } catch (\Throwable $e) {
            return new JsonResponse(['users' => [], 'error' => $e->getMessage()]);
        }
    }

    public function discussions(ServerRequestInterface $request): ResponseInterface
    {
        $params = $request->getQueryParams();
        $nodeId = $params['node_id'] ?? '';
        $query = trim($params['q'] ?? '');

        $node = $this->findNode($nodeId);
        if (!$node) {
            return new JsonResponse(['error' => 'Hedef platform bulunamadı.'], 404);
        }

        $nodeUrl = rtrim($node['url'], '/');
        $targetApiUrl = $nodeUrl . '/api/discussions';

        $client = new Client([
            'timeout' => 10.0,
            'connect_timeout' => 5.0,
            'http_errors' => false,
        ]);

        try {
            $queryParams = [
                'page[limit]' => 8,
                'include' => 'tags,user',
            ];
            if (!empty($query)) {
                $queryParams['filter[q]'] = $query;
            }

            $response = $client->get($targetApiUrl, [
                'query' => $queryParams,
                'headers' => [
                    'Accept' => 'application/vnd.api+json, application/json',
                    'User-Agent' => 'FramioCrosspost/1.0',
                ],
            ]);

            if ($response->getStatusCode() !== 200) {
                return new JsonResponse(['discussions' => []]);
            }

            $data = json_decode((string) $response->getBody(), true);
            $discussionsRaw = $data['data'] ?? [];
            $included = $data['included'] ?? [];

            // İlgili etiketleri eşleştir
            $tagMap = [];
            foreach ($included as $item) {
                if (($item['type'] ?? '') === 'tags') {
                    $tagMap[$item['id']] = $item['attributes']['name'] ?? '';
                }
            }

            $discussions = [];
            foreach ($discussionsRaw as $d) {
                $attrs = $d['attributes'] ?? [];
                $id = $d['id'] ?? '';
                $slug = $attrs['slug'] ?? '';
                $title = $attrs['title'] ?? 'Başlıksız';
                $commentCount = $attrs['commentCount'] ?? 0;
                $createdAt = $attrs['createdAt'] ?? null;
                $lastPostedAt = $attrs['lastPostedAt'] ?? null;

                // Tartışmanın doğrudan URL'si
                $cleanSlug = $slug;
                if (!empty($slug) && (str_starts_with($slug, $id . '-') || $slug === (string) $id)) {
                    $cleanSlug = $slug;
                } else {
                    $cleanSlug = $id . ($slug ? '-' . $slug : '');
                }
                $discussionUrl = $nodeUrl . '/d/' . $cleanSlug;

                $discussions[] = [
                    'id' => $id,
                    'title' => $title,
                    'slug' => $slug,
                    'comment_count' => $commentCount,
                    'created_at' => $createdAt,
                    'last_posted_at' => $lastPostedAt,
                    'url' => $discussionUrl,
                ];
            }

            return new JsonResponse(['discussions' => $discussions]);
        } catch (\Throwable $e) {
            return new JsonResponse(['discussions' => [], 'error' => $e->getMessage()]);
        }
    }

    public function watermarks(ServerRequestInterface $request): ResponseInterface
    {
        $params = $request->getQueryParams();
        $nodeId = $params['node_id'] ?? '';
        $username = trim($params['username'] ?? '');

        $node = $this->findNode($nodeId);
        if (!$node) {
            return new JsonResponse(['error' => 'Hedef platform bulunamadı.'], 404);
        }

        $nodeUrl = rtrim($node['url'], '/');
        $secretKey = $node['secret_key'] ?? '';
        $targetApiUrl = $nodeUrl . '/api/framio/crosspost/watermarks';

        $client = new Client([
            'timeout' => 10.0,
            'connect_timeout' => 5.0,
            'http_errors' => false,
        ]);

        try {
            $queryArgs = ['secret' => $secretKey];
            if (!empty($username)) {
                $queryArgs['username'] = $username;
            }

            $response = $client->get($targetApiUrl, [
                'query' => $queryArgs,
                'headers' => [
                    'Accept' => 'application/json',
                    'User-Agent' => 'FramioCrosspost/1.0',
                ],
            ]);

            if ($response->getStatusCode() !== 200) {
                return new JsonResponse(['watermarks' => []]);
            }

            $data = json_decode((string) $response->getBody(), true);
            $watermarks = $data['watermarks'] ?? [];

            // Görsel URL'lerini mutlak URL'ye tamamla
            foreach ($watermarks as &$wm) {
                if (!empty($wm['url']) && str_starts_with($wm['url'], '/')) {
                    $wm['url'] = $nodeUrl . $wm['url'];
                }
            }

            return new JsonResponse([
                'watermarks' => $watermarks,
                'owner_username' => $data['owner_username'] ?? null,
                'has_personal_watermark' => $data['has_personal_watermark'] ?? false,
                'requested_username' => $username,
            ]);
        } catch (\Throwable $e) {
            return new JsonResponse(['watermarks' => [], 'error' => $e->getMessage()]);
        }
    }

    protected function findNode(string $nodeId): ?array
    {
        $nodesRaw = $this->settings->get('framio-network-crosspost.nodes', '[]');
        $nodes = json_decode($nodesRaw, true);
        if (!is_array($nodes)) {
            return null;
        }

        foreach ($nodes as $node) {
            if (($node['id'] ?? '') === $nodeId && !empty($node['url'])) {
                return $node;
            }
        }

        return null;
    }
}
