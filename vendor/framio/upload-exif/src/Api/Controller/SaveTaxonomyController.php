<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\UploadExif\Database\MediaTaxonomy;
use Illuminate\Support\Arr;

class SaveTaxonomyController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        $body = $request->getParsedBody();
        $action = Arr::get($body, 'action', 'save'); // 'save' | 'delete' | 'sync' | 'reorder' | 'update'

        if ($action === 'reorder') {
            $order = Arr::get($body, 'order', []);
            foreach ($order as $index => $id) {
                MediaTaxonomy::where('id', $id)->update(['sort_order' => $index]);
            }
            return new JsonResponse(['success' => true]);
        }

        if ($action === 'delete') {
            $id = Arr::get($body, 'id');
            MediaTaxonomy::where('id', $id)->delete();
            return new JsonResponse(['success' => true]);
        }

        if ($action === 'delete_discussion_group') {
            $brand = Arr::get($body, 'brand');
            $type = Arr::get($body, 'type');
            $discId = Arr::get($body, 'discussion_id');
            $query = MediaTaxonomy::where('brand', $brand);
            if ($type) {
                $query->where(function($q) use ($type) {
                    $q->where('category', $type);
                });
            }
            if ($discId) {
                $query->where('discussion_id', $discId);
            } else {
                $query->whereNull('discussion_id');
            }
            $query->delete();
            return new JsonResponse(['success' => true]);
        }

        if ($action === 'update_discussion') {
            $brand = Arr::get($body, 'brand');
            $type = Arr::get($body, 'type');
            $oldDiscId = Arr::get($body, 'old_discussion_id');
            $newDiscussion = Arr::get($body, 'new_discussion');
            $newDiscId = null;
            if (!empty($newDiscussion)) {
                if (preg_match('/\/d\/(\d+)/', $newDiscussion, $m)) {
                    $newDiscId = (int)$m[1];
                } elseif (is_numeric($newDiscussion)) {
                    $newDiscId = (int)$newDiscussion;
                }
            }
            $query = MediaTaxonomy::where('brand', $brand);
            if ($type) {
                $query->where('category', $type);
            }
            if ($oldDiscId) {
                $query->where('discussion_id', $oldDiscId);
            } else {
                $query->whereNull('discussion_id');
            }
            $query->update(['discussion_id' => $newDiscId]);
            return new JsonResponse(['success' => true]);
        }

        if ($action === 'update') {
            $id = Arr::get($body, 'id');
            $item = MediaTaxonomy::findOrFail($id);
            if (isset($body['model'])) $item->model = trim($body['model']);
            if (isset($body['brand'])) $item->brand = trim($body['brand']);
            if (array_key_exists('city', $body)) $item->city = $body['city'];
            if (array_key_exists('category', $body)) $item->category = $body['category'];
            if (array_key_exists('type', $body)) $item->category = $body['type'];
            if (array_key_exists('discussion_id', $body)) $item->discussion_id = $body['discussion_id'];
            $item->save();
            return new JsonResponse(['success' => true, 'data' => $item]);
        }

        if ($action === 'sync') {
            $rules = Arr::get($body, 'rules', []);
            MediaTaxonomy::truncate();
            foreach ($rules as $index => $rule) {
                MediaTaxonomy::create([
                    'brand' => $rule['brand'] ?? '',
                    'model' => $rule['model'] ?? '',
                    'category' => $rule['category'] ?? 'bus',
                    'tag_slug' => $rule['tag_slug'] ?? null,
                    'discussion_id' => !empty($rule['discussion_id']) ? (int)$rule['discussion_id'] : null,
                    'city' => $rule['city'] ?? null,
                    'sort_order' => $index,
                ]);
            }
            return new JsonResponse(['success' => true]);
        }

        // Discussion parsing (URL or ID)
        $discussionInput = Arr::get($body, 'discussion');
        $discussionId = Arr::get($body, 'discussion_id');
        if (!empty($discussionInput) && empty($discussionId)) {
            if (preg_match('/\/d\/(\d+)/', $discussionInput, $m)) {
                $discussionId = (int)$m[1];
            } elseif (is_numeric($discussionInput)) {
                $discussionId = (int)$discussionInput;
            }
        }

        $id = Arr::get($body, 'id');
        $data = [
            'brand' => trim(Arr::get($body, 'brand', '')),
            'model' => trim(Arr::get($body, 'model', '')),
            'category' => Arr::get($body, 'category') ?? Arr::get($body, 'type', 'bus'),
            'tag_slug' => Arr::get($body, 'tag_slug') ?: null,
            'discussion_id' => $discussionId ? (int)$discussionId : null,
            'city' => Arr::get($body, 'city') ?: null,
            'sort_order' => (int)Arr::get($body, 'sort_order', 0),
        ];

        if ($id) {
            $item = MediaTaxonomy::findOrFail($id);
            $item->update($data);
        } else {
            $item = MediaTaxonomy::create($data);
        }

        return new JsonResponse(['success' => true, 'data' => $item]);
    }
}
