<?php

namespace Framio\NetworkCrosspost;

use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\PostResource;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Extend;
use Flarum\Post\Post;
use Framio\NetworkCrosspost\Access\DiscussionPolicy;
use Framio\NetworkCrosspost\Api\Controller\InboundCrosspostController;
use Framio\NetworkCrosspost\Api\Controller\ListNodesController;
use Framio\NetworkCrosspost\Api\Controller\ListWatermarksController;
use Framio\NetworkCrosspost\Api\Controller\OutboundCrosspostController;
use Framio\NetworkCrosspost\Api\Controller\TargetDataController;
use Framio\NetworkCrosspost\Api\Controller\TestConnectionController;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/dist/forum.js')
        ->css(__DIR__ . '/resources/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__ . '/js/dist/admin.js')
        ->css(__DIR__ . '/resources/less/admin.less'),

    new Extend\Locales(__DIR__ . '/resources/locale'),

    (new Extend\Routes('api'))
        ->post('/framio/crosspost/inbound', 'framio.crosspost.inbound', InboundCrosspostController::class)
        ->post('/framio/crosspost/outbound', 'framio.crosspost.outbound', OutboundCrosspostController::class)
        ->get('/framio/crosspost/nodes', 'framio.crosspost.nodes', ListNodesController::class)
        ->get('/framio/crosspost/watermarks', 'framio.crosspost.watermarks', ListWatermarksController::class)
        ->get('/framio/crosspost/target-data', 'framio.crosspost.target-data', TargetDataController::class)
        ->post('/framio/crosspost/test-node', 'framio.crosspost.test-node', TestConnectionController::class),

    (new Extend\Csrf())
        ->exemptRoute('framio.crosspost.inbound')
        ->exemptRoute('framio.crosspost.watermarks'),

    (new Extend\Policy())
        ->modelPolicy(Discussion::class, DiscussionPolicy::class),

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(fn () => [
            Schema\Str::make('crosspostSourcePlatform')
                ->property('crosspost_source_platform')
                ->nullable(),
            Schema\Str::make('crosspostSourceUrl')
                ->property('crosspost_source_url')
                ->nullable(),
            Schema\Str::make('crosspostSourceAuthor')
                ->property('crosspost_source_author')
                ->nullable(),
            Schema\Str::make('crosspostSourceAuthorUrl')
                ->property('crosspost_source_author_url')
                ->nullable(),
            Schema\Str::make('crosspostSourceAuthorAvatar')
                ->property('crosspost_source_author_avatar')
                ->nullable(),
            Schema\Str::make('crosspostSyncKey')
                ->property('crosspost_sync_key')
                ->nullable(),
        ]),

    (new Extend\ApiResource(PostResource::class))
        ->fields(fn () => [
            Schema\Str::make('crosspostSourcePlatform')
                ->property('crosspost_source_platform')
                ->nullable(),
            Schema\Str::make('crosspostSourceUrl')
                ->property('crosspost_source_url')
                ->nullable(),
            Schema\Str::make('crosspostSourceAuthor')
                ->property('crosspost_source_author')
                ->nullable(),
        ]),

    (new Extend\Settings())
        ->serializeToForum('framioCrosspostCurrentPlatform', 'framio-network-crosspost.current_platform_name', 'strval', 'Ulaşım Info')
        ->serializeToForum('framioCrosspostWmAllowKeepSource', 'framio-network-crosspost.wm_allow_keep_source', 'boolval', true)
        ->serializeToForum('framioCrosspostWmAllowTargetSite', 'framio-network-crosspost.wm_allow_target_site', 'boolval', true)
        ->serializeToForum('framioCrosspostWmAllowNoWatermark', 'framio-network-crosspost.wm_allow_no_watermark', 'boolval', false)
        ->serializeToForum('framioCrosspostWmAllowCustomUpload', 'framio-network-crosspost.wm_allow_custom_upload', 'boolval', false)
        ->serializeToForum('framioCrosspostWmDefaultMode', 'framio-network-crosspost.wm_default_mode', 'strval', 'keep_source')
        ->serializeToForum('framioCrosspostAllowAdminSelectUser', 'framio-network-crosspost.allow_admin_select_user', 'boolval', true),
];
