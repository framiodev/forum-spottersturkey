<?php

namespace Framio\Profiles\ProfileStories\Serializer;


use Carbon\Carbon;
use Flarum\Api\Serializer\AbstractSerializer;
use Flarum\Api\Serializer\UserSerializer;

class StorySerializer extends AbstractSerializer
{
    protected $type = 'stories';

    protected function getDefaultAttributes($model): array
    {
        return [
            'id'            => $model->id,
            'userId'        => $model->user_id,
            'title'         => $model->title,
            'imgUrl'        => $model->img_url,
            'cta'           => $model->cta,
            'contentIcon'   => $model->content_icon,
            'contentText'   => $model->content_text,
            'contentCta'    => $model->content_cta,
            'contentLink'   => $model->content_link,
            'username'      => $model->username,
            'createdAt'     => Carbon::parse($model->created_at)->toIso8601String(),
            'updatedAt'     => Carbon::parse($model->updated_at)->toIso8601String(),
        ];
    }

    protected function user($model)
    {
        return $this->hasOne($model, UserSerializer::class, 'user');
    }
}
