<?php

namespace Framio\UploadExif\Api\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Framio\UploadExif\Database\MediaCategorySchema;
use Illuminate\Support\Arr;

class ListCategorySchemasController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $params = $request->getQueryParams();

        // Check for discussion_id mapping first
        if ($discussionId = Arr::get($params, 'discussion_id')) {
            $schemas = MediaCategorySchema::all();
            foreach ($schemas as $schema) {
                $tagSlugs = $schema->tag_slugs;
                if (is_array($tagSlugs) && in_array('url:' . $discussionId, $tagSlugs)) {
                    return new JsonResponse(['data' => $schema->toArray()]);
                }
            }
        }

        // If tag_slug is provided, find the matching category schema
        if ($tagSlug = Arr::get($params, 'tag_slug')) {
            $schemas = MediaCategorySchema::all();
            $matched = null;
            foreach ($schemas as $schema) {
                $tagSlugs = $schema->tag_slugs;
                if (is_array($tagSlugs) && in_array($tagSlug, $tagSlugs)) {
                    $matched = $schema;
                    break;
                }
            }
            // If no direct match, try parent categories
            if (!$matched) {
                // Check if the Flarum tag has a parent tag that matches
                $tag = \Flarum\Tags\Tag::where('slug', $tagSlug)->first();
                if ($tag && $tag->parent_id) {
                    $parentTag = \Flarum\Tags\Tag::find($tag->parent_id);
                    if ($parentTag) {
                        foreach ($schemas as $schema) {
                            $tagSlugs = $schema->tag_slugs;
                            if (is_array($tagSlugs) && in_array($parentTag->slug, $tagSlugs)) {
                                $matched = $schema;
                                break;
                            }
                        }
                    }
                }
            }
            if ($matched) {
                return new JsonResponse(['data' => $matched->toArray()]);
            }
            // Return default schema (first root with no parent that has fields_config)
            $default = MediaCategorySchema::whereNull('parent_id')
                ->whereNotNull('fields_config')
                ->orderBy('sort_order')
                ->first();
            if ($default) {
                return new JsonResponse(['data' => $default->toArray()]);
            }
            return new JsonResponse(['data' => null]);
        }

        // Return all schemas (for admin panel)
        $schemas = MediaCategorySchema::orderBy('sort_order')->get()->toArray();
        return new JsonResponse(['data' => $schemas]);
    }
}
