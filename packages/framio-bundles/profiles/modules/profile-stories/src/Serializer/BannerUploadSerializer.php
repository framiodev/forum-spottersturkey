<?php

namespace Framio\Profiles\ProfileStories\Serializer;



use Flarum\Api\Serializer\AbstractSerializer;

class BannerUploadSerializer extends AbstractSerializer
{

    protected $type = 'story-banner-upload';

    protected function getDefaultAttributes($object)
    {
        return [
            'path' => $object->path,
            'url'  => $object->url,
        ];
    }
}
