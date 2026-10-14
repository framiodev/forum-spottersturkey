<?php

use Flarum\Api\Endpoint;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Flarum\Tags\Api\Resource\TagResource;
use Flarum\Tags\Event\Creating;
use Flarum\Tags\Event\Saving;
use Flarum\Tags\Tag;
use Framio\Content\DeepTags\Api\Controller\RecursiveOrderTagsController;
use Framio\Content\DeepTags\Listener\CreateTagParent;
use Framio\Content\DeepTags\Listener\SaveTagParent;

return [
    (new Extend\Routes('api'))
        ->remove('tags.order')
        ->post('/tags/order', 'tags.order', RecursiveOrderTagsController::class),

    (new Extend\Event())
        ->listen(Saving::class, SaveTagParent::class)
        ->listen(Creating::class, CreateTagParent::class),

    (new Extend\ApiResource(TagResource::class))
        ->field('parent', fn ($field) => $field->writable())
        ->fields(fn () => [
            Schema\Integer::make('parentId')
                ->writable()
                ->nullable()
                ->get(fn (Tag $tag) => $tag->parent_id)
                ->set(function (Tag $tag, $value) {
                    $tag->parent_id = $value ? (int) $value : null;
                    if ($tag->parent_id) {
                        $tag->is_primary = true;
                        if ($tag->position === null) {
                            $max = Tag::where('parent_id', $tag->parent_id)->max('position');
                            $tag->position = is_numeric($max) ? (int) $max + 1 : 0;
                        }
                    }
                }),
        ])
        ->endpoint(Endpoint\Index::class, fn (Endpoint\Index $endpoint) => $endpoint->defaultInclude(['parent', 'children'])),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            \Flarum\Api\Schema\Relationship\ToMany::make('tags')
                ->includable()
                ->get(function ($model, \Flarum\Api\Context $context) {
                    $actor = $context->getActor();

                    // Tüm seviyelerdeki birincil ve ikincil hiyerarşik etiketleri yükle
                    return \Flarum\Tags\Tag::whereVisibleTo($actor)
                        ->withStateFor($actor)
                        ->get()
                        ->all();
                }),
        ])
        ->endpoint(Endpoint\Show::class, fn (Endpoint\Show $endpoint) => $endpoint->addDefaultInclude(['tags', 'tags.parent', 'tags.children'])),

    new Extend\Locales(__DIR__ . '/locale'),
];
