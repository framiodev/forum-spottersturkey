<?php

namespace Stezkoy\FlarumModularis\Api\Resource;

use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Stezkoy\FlarumModularis\CssValidator;
use Stezkoy\FlarumModularis\Event\StyleCreated;
use Stezkoy\FlarumModularis\Event\StyleDeleted;
use Stezkoy\FlarumModularis\Event\StyleUpdated;
use Stezkoy\FlarumModularis\Style;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Arr;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * @extends AbstractDatabaseResource<Style>
 */
class StyleResource extends AbstractDatabaseResource
{
    public function __construct(
        protected Dispatcher $events,
        protected CssValidator $validator,
    ) {
    }

    public function type(): string
    {
        return 'modularis-styles';
    }

    public function model(): string
    {
        return Style::class;
    }

    public function endpoints(): array
    {
        return [
            Endpoint\Index::make()
                ->authenticated()
                ->can('administrate')
                ->defaultSort('sortOrder'),

            Endpoint\Create::make()
                ->authenticated()
                ->can('administrate'),

            Endpoint\Update::make()
                ->authenticated()
                ->can('administrate'),

            Endpoint\Delete::make()
                ->authenticated()
                ->can('administrate'),
        ];
    }

    public function fields(): array
    {
        return [
            Schema\Str::make('name')
                ->requiredOnCreate()
                ->maxLength(200)
                ->writable(),

            Schema\Str::make('css')
                ->requiredOnCreate()
                ->maxLength(100000)
                ->writable(),

            Schema\Str::make('scope')
                ->requiredOnCreate()
                ->in(Style::VALID_SCOPES)
                ->writable(),

            Schema\Boolean::make('active')
                ->writable()
                ->default(false),

            Schema\Integer::make('sortOrder')
                ->writable()
                ->default(0)
                ->property('sort_order'),

            Schema\DateTime::make('createdAt')
                ->visible(),

            Schema\DateTime::make('updatedAt')
                ->visible(),
        ];
    }

    public function sorts(): array
    {
        return [
            \Flarum\Api\Sort\SortColumn::make('sortOrder'),
        ];
    }

    public function create(object $model, OriginalContext $context): object
    {
        $this->validator->assertValid(Arr::get($context->body(), 'data.attributes.css'));

        parent::create($model, $context);

        $this->events->dispatch(
            new StyleCreated($model, $context->getActor(), $context->body())
        );

        return $model;
    }

    public function update(object $model, OriginalContext $context): object
    {
        $attributes = Arr::get($context->body(), 'data.attributes', []);

        if (array_key_exists('css', $attributes)) {
            $this->validator->assertValid($attributes['css']);
        } elseif (!empty($attributes['active'])) {
            // A style can only be enabled if its stored CSS is valid.
            $this->validator->assertValid($model->css);
        }

        parent::update($model, $context);

        if ($model->wasChanged()) {
            $this->events->dispatch(
                new StyleUpdated($model, $context->getActor(), $context->body())
            );
        }

        return $model;
    }

    public function delete(object $model, OriginalContext $context): void
    {
        parent::delete($model, $context);

        $this->events->dispatch(
            new StyleDeleted($model, $context->getActor())
        );
    }
}
