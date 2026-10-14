<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\UploadExif\Database\MediaTaxonomy;
use Illuminate\Support\Arr;

class ListTaxonomyController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $params = $request->getQueryParams();
        $query = MediaTaxonomy::query();

        if ($discussionId = Arr::get($params, 'discussion_id')) {
            $query->where(function ($q) use ($discussionId) {
                $q->where('discussion_id', $discussionId)
                  ->orWhereNull('discussion_id');
            });
        }

        if ($tagSlug = Arr::get($params, 'tag_slug')) {
            $query->where(function ($q) use ($tagSlug) {
                $q->where('tag_slug', $tagSlug)
                  ->orWhereNull('tag_slug');
            });
        }

        if ($city = Arr::get($params, 'city')) {
            $query->where(function ($q) use ($city) {
                $q->where('city', $city)
                  ->orWhereNull('city');
            });
        }

        $items = $query->orderBy('sort_order', 'asc')->orderBy('brand', 'asc')->get();

        $data = $items->map(function ($item) {
            $arr = $item->toArray();
            $arr['type'] = $item->category ?: 'bus';
            if ($item->discussion_id) {
                $discussion = \Flarum\Discussion\Discussion::find($item->discussion_id);
                if ($discussion) {
                    $arr['discussion'] = [
                        'id' => $discussion->id,
                        'slug' => $discussion->slug,
                        'title' => $discussion->title,
                    ];
                }
            }
            return $arr;
        });

        return new JsonResponse(['data' => $data]);
    }
}
