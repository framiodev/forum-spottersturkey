<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\UploadExif\Database\MediaCategorySchema;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class SaveCategorySchemaController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        $body = $request->getParsedBody();
        $action = Arr::get($body, 'action', 'save');

        if ($action === 'delete') {
            $id = Arr::get($body, 'id');
            // Set children's parent_id to null
            MediaCategorySchema::where('parent_id', $id)->update(['parent_id' => null]);
            MediaCategorySchema::where('id', $id)->delete();
            // Also update taxonomy records that referenced this category
            // (optional: we keep them as-is since category column stores slug)
            return new JsonResponse(['success' => true]);
        }

        if ($action === 'reorder') {
            $items = Arr::get($body, 'items', []);
            foreach ($items as $item) {
                $id = Arr::get($item, 'id');
                if (!$id) continue;
                $update = [];
                if (array_key_exists('sort_order', $item)) $update['sort_order'] = (int)$item['sort_order'];
                if (array_key_exists('parent_id', $item)) $update['parent_id'] = $item['parent_id'] ?: null;
                if (!empty($update)) {
                    MediaCategorySchema::where('id', $id)->update($update);
                }
            }
            return new JsonResponse(['success' => true]);
        }

        if ($action === 'bulk_save') {
            $schemas = Arr::get($body, 'schemas', []);
            // Process each schema
            foreach ($schemas as $index => $schemaData) {
                $id = Arr::get($schemaData, 'id');
                $data = [
                    'name' => Arr::get($schemaData, 'name', ''),
                    'slug' => Arr::get($schemaData, 'slug') ?: Str::slug(Arr::get($schemaData, 'name', '')),
                    'icon' => Arr::get($schemaData, 'icon', 'fas fa-folder'),
                    'parent_id' => Arr::get($schemaData, 'parent_id') ?: null,
                    'tag_slugs' => Arr::get($schemaData, 'tag_slugs'),
                    'fields_config' => Arr::get($schemaData, 'fields_config'),
                    'output_template' => Arr::get($schemaData, 'output_template'),
                    'sort_order' => Arr::get($schemaData, 'sort_order', $index),
                ];
                // Ensure tag_slugs and fields_config are JSON-encoded if they're arrays
                if (is_array($data['tag_slugs'])) $data['tag_slugs'] = json_encode($data['tag_slugs']);
                if (is_array($data['fields_config'])) $data['fields_config'] = json_encode($data['fields_config']);

                if ($id) {
                    $schema = MediaCategorySchema::find($id);
                    if ($schema) {
                        $schema->update($data);
                    }
                } else {
                    MediaCategorySchema::create($data);
                }
            }
            return new JsonResponse(['success' => true]);
        }

        // Default: save single schema
        $id = Arr::get($body, 'id');
        $data = [
            'name' => trim(Arr::get($body, 'name', '')),
            'slug' => Arr::get($body, 'slug') ?: Str::slug(trim(Arr::get($body, 'name', ''))),
            'icon' => Arr::get($body, 'icon', 'fas fa-folder'),
            'parent_id' => Arr::get($body, 'parent_id') ?: null,
            'tag_slugs' => Arr::get($body, 'tag_slugs'),
            'fields_config' => Arr::get($body, 'fields_config'),
            'output_template' => Arr::get($body, 'output_template'),
            'sort_order' => (int)Arr::get($body, 'sort_order', 0),
        ];

        // Ensure tag_slugs and fields_config are JSON-encoded if they're arrays
        if (is_array($data['tag_slugs'])) $data['tag_slugs'] = json_encode($data['tag_slugs']);
        if (is_array($data['fields_config'])) $data['fields_config'] = json_encode($data['fields_config']);

        if ($id) {
            $schema = MediaCategorySchema::findOrFail($id);
            $schema->update($data);
        } else {
            $schema = MediaCategorySchema::create($data);
        }

        return new JsonResponse(['success' => true, 'data' => $schema->toArray()]);
    }
}
