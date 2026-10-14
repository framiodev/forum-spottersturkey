<?php

namespace Framio\SocialNewsletter;

use Flarum\Database\AbstractModel;

class Lead extends AbstractModel
{
    protected $table = 'framio_social_leads';

    protected $fillable = [
        'name',
        'contact_type',
        'contact_value',
        'is_contacted',
        'is_following',
        'push_endpoint',
        'push_p256dh',
        'push_auth'
    ];

    protected $casts = [
        'is_contacted' => 'boolean',
        'is_following' => 'boolean'
    ];

    protected $dates = [
        'created_at',
        'updated_at'
    ];
}
