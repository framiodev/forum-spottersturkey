<?php

namespace Framio\SocialNewsletter;

use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/dist/forum.js')
        ->css(__DIR__ . '/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__ . '/js/dist/admin.js')
        ->css(__DIR__ . '/less/admin.less'),

    (new Extend\Routes('api'))
        ->post('/framio-social-leads', 'framio-social-leads.create', Api\Controller\CreateLeadController::class)
        ->get('/framio-social-leads', 'framio-social-leads.index', Api\Controller\ListLeadsController::class)
        ->patch('/framio-social-leads/{id}', 'framio-social-leads.update', Api\Controller\UpdateLeadController::class)
        ->delete('/framio-social-leads/{id}', 'framio-social-leads.delete', Api\Controller\DeleteLeadController::class),

    (new Extend\Settings())
        ->serializeToForum('framio-social-newsletter.popup_title', 'framio-social-newsletter.popup_title', 'strval', 'Bizimle İletişime Geçin')
        ->serializeToForum('framio-social-newsletter.popup_desc', 'framio-social-newsletter.popup_desc', 'strval', 'Size ulaşabilmemiz için bilgilerinizi bırakın.')
        ->serializeToForum('framio-social-newsletter.popup_delay', 'framio-social-newsletter.popup_delay', 'intval', 30)
        ->serializeToForum('framio-social-newsletter.vapid_public', 'framio-social-newsletter.vapid_public', 'strval', ''),
        
    (new Extend\Event())
        ->subscribe(Listener\SendPushOnNewContent::class),
];
