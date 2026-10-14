<?php

namespace Framio\Profiles\CustomProfilePage;

use Flarum\Api\Context;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema;
use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__.'/resources/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->css(__DIR__.'/resources/less/admin.less'),

    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\Routes('api'))
        ->get('/users/{id}/custom-page', 'custom-profile-page.show', Api\Controller\ShowCustomPageController::class)
        ->post('/users/{id}/custom-page', 'custom-profile-page.create', Api\Controller\CreateCustomPageController::class)
        ->patch('/users/{id}/custom-page', 'custom-profile-page.update', Api\Controller\UpdateCustomPageController::class),

    (new Extend\Model(\Flarum\User\User::class))
        ->hasOne('customPage', CustomProfilePage::class, 'user_id'),

    (new Extend\Policy())
        ->modelPolicy(CustomProfilePage::class, Access\CustomProfilePagePolicy::class),

    (new Extend\Settings())
        ->default('huseyinfiliz-custom-profile-page.tab_icon', 'fas fa-file-alt')
        ->serializeToForum('huseyinfiliz-custom-profile-page.tab_icon', 'huseyinfiliz-custom-profile-page.tab_icon')
        ->default('huseyinfiliz-custom-profile-page.tab_title', 'Custom Page')
        ->serializeToForum('huseyinfiliz-custom-profile-page.tab_title', 'huseyinfiliz-custom-profile-page.tab_title')
        ->default('huseyinfiliz-custom-profile-page.url_slug', 'customPage')
        ->serializeToForum('huseyinfiliz-custom-profile-page.url_slug', 'huseyinfiliz-custom-profile-page.url_slug')
        ->default('huseyinfiliz-custom-profile-page.content_format', 'markdown')
        ->serializeToForum('huseyinfiliz-custom-profile-page.content_format', 'huseyinfiliz-custom-profile-page.content_format')
        ->default('huseyinfiliz-custom-profile-page.allowed_html_tags', 'b,i,u,strong,em,a,br,p,ul,ol,li,blockquote,code,pre')
        ->serializeToForum('huseyinfiliz-custom-profile-page.allowed_html_tags', 'huseyinfiliz-custom-profile-page.allowed_html_tags')
        ->default('huseyinfiliz-custom-profile-page.default_template', '')
        ->serializeToForum('huseyinfiliz-custom-profile-page.default_template', 'huseyinfiliz-custom-profile-page.default_template')
        ->default('huseyinfiliz-custom-profile-page.enable_media_embeds', '1')
        ->serializeToForum('huseyinfiliz-custom-profile-page.enable_media_embeds', 'huseyinfiliz-custom-profile-page.enable_media_embeds', 'boolval'),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('canViewCustomPage')
                ->get(fn ($forum, Context $context) => $context->getActor()->isGuest() || $context->getActor()->hasPermission('user.viewCustomPage')),
            Schema\Boolean::make('canEditOwnCustomPage')
                ->get(fn ($forum, Context $context) => $context->getActor()->hasPermission('user.editOwnCustomPage')),
        ]),
];
