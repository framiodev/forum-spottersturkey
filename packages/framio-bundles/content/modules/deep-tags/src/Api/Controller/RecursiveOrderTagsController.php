<?php

namespace Framio\Content\DeepTags\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Tags\Tag;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class RecursiveOrderTagsController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        $order = Arr::get($request->getParsedBody(), 'order');

        if ($order === null) {
            return new EmptyResponse(422);
        }

        // Birincil etiketleri ve alt etiketleri sıfırla
        Tag::query()->update([
            'position' => null,
            'parent_id' => null,
            'is_primary' => false,
        ]);

        // Özyinelemeli (recursive) olarak tüm derinliklerdeki etiketleri ve hiyerarşiyi kaydet
        $this->processOrderLevel($order, null);

        return new EmptyResponse(204);
    }

    /**
     * @param array $items
     * @param int|null $parentId
     */
    protected function processOrderLevel(array $items, ?int $parentId): void
    {
        foreach ($items as $position => $item) {
            $tagId = Arr::get($item, 'id');
            if (!$tagId) {
                continue;
            }

            Tag::where('id', $tagId)->update([
                'position' => $position,
                'parent_id' => $parentId,
                'is_primary' => true,
            ]);

            // Alt çocuklar varsa (children array), özyinelemeli olarak işle
            $children = Arr::get($item, 'children');
            if (is_array($children) && !empty($children)) {
                // $children hem array of IDs [1, 2] hem de array of objects [{'id': 1, 'children': [...]}] formatında gelebilir
                $normalizedChildren = [];
                foreach ($children as $c) {
                    if (is_array($c) && isset($c['id'])) {
                        $normalizedChildren[] = $c;
                    } elseif (is_numeric($c)) {
                        $normalizedChildren[] = ['id' => (int) $c];
                    }
                }

                $this->processOrderLevel($normalizedChildren, (int) $tagId);
            }
        }
    }
}
