<?php

namespace Framio\NetworkCrosspost\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class ListNodesController implements RequestHandlerInterface
{
    public function __construct(
        protected SettingsRepositoryInterface $settings
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        if ($actor->isGuest()) {
            return new JsonResponse(['error' => 'Bu işlem için giriş yapmalısınız.'], 401);
        }

        $rawNodes = $this->settings->get('framio-network-crosspost.nodes', '[]');
        $nodes = json_decode($rawNodes, true);
        if (!is_array($nodes)) {
            $nodes = [];
        }

        // Tartışma eşleşmeleri: bu sitedeki bir tartışma diğer sitede hangi tartışmaya denk geliyor
        $sourceId = (int) Arr::get($request->getQueryParams(), 'discussion_id', 0);
        $mapped = [];
        if ($sourceId > 0) {
            $map = json_decode((string) $this->settings->get('framio-network-crosspost.discussion_map', '[]'), true);
            foreach (is_array($map) ? $map : [] as $row) {
                if (self::discussionId((string) Arr::get($row, 'source', '')) === $sourceId && Arr::get($row, 'node') && trim((string) Arr::get($row, 'target_url', '')) !== '') {
                    $mapped[(string) $row['node']] = [
                        'url' => trim((string) $row['target_url']),
                        'title' => trim((string) Arr::get($row, 'target_title', '')),
                    ];
                }
            }
        }

        // Güvenlik: secret_key bilgisini frontend'e kesinlikle sızdırmıyoruz!
        $safeNodes = [];
        foreach ($nodes as $index => $node) {
            $isEnabled = (bool) Arr::get($node, 'enabled', true);
            if (!$isEnabled) {
                continue;
            }

            $safeNodes[] = [
                'id' => Arr::get($node, 'id', (string) $index),
                'name' => Arr::get($node, 'name', 'Ağ Düğümü'),
                'url' => Arr::get($node, 'url', ''),
                'default_tag_slug' => Arr::get($node, 'default_tag_slug', ''),
                'mapped' => $mapped[(string) Arr::get($node, 'id', (string) $index)] ?? null,
            ];
        }

        return new JsonResponse([
            'nodes' => $safeNodes,
            'can_crosspost' => $actor->isAdmin() || $actor->hasPermission('discussion.crosspost')
        ]);
    }

    /** "123", "/d/123-slug" veya tam bağlantıdan tartışma kimliği */
    public static function discussionId(string $value): int
    {
        $value = trim($value);
        if (ctype_digit($value)) {
            return (int) $value;
        }
        return preg_match('~/d/(\d+)~', $value, $m) ? (int) $m[1] : 0;
    }
}
