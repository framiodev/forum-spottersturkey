<?php

namespace Framio\SocialNewsletter;

use Flarum\Api\Serializer\AbstractSerializer;
use InvalidArgumentException;

class LeadSerializer extends AbstractSerializer
{
    protected $type = 'social-leads';

    protected function getDefaultAttributes($lead)
    {
        if (! ($lead instanceof Lead)) {
            throw new InvalidArgumentException(
                get_class($this).' can only serialize instances of '.Lead::class
            );
        }

        return [
            'name'          => $lead->name,
            'contact_type'  => $lead->contact_type,
            'contact_value' => $lead->contact_value,
            'is_contacted'  => $lead->is_contacted,
            'is_following'  => $lead->is_following,
            'createdAt'     => $this->formatDate($lead->created_at),
        ];
    }
}
