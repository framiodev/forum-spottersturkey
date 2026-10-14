<?php

namespace Framio\UploadExif\Api\Serializer;

use Flarum\Api\Serializer\AbstractSerializer;
use Flarum\Api\Serializer\UserSerializer;

class FramioImageSerializer extends AbstractSerializer
{
    protected $type = 'framio-images';

    protected function getDefaultAttributes($model)
    {
        $actor = $this->request ? $this->request->getAttribute('actor') : null;
        $canSeeOriginal = $actor && ($actor->isAdmin() || (int)$actor->id === (int)$model->user_id);

        $music = null;
        if (!empty($model->music_data)) {
            $music = is_string($model->music_data) ? json_decode($model->music_data, true) : $model->music_data;
        }

        $exif = null;
        if (!empty($model->exif_data)) {
            $exif = is_string($model->exif_data) ? json_decode($model->exif_data, true) : $model->exif_data;
        }

        return [
            'id'            => $model->id,
            'user_id'       => $model->user_id,
            'filename'      => $model->filename,
            'url'           => $model->path,
            'thumb_path'    => $model->thumb_path ?: $model->path,
            'original_path' => $canSeeOriginal ? $model->original_path : null,
            'mime_type'     => $model->mime_type,
            'music_data'    => $music,
            'exif_data'     => $exif,
            'title'         => $model->title,
            'description'   => $model->description,
            'createdAt'     => $this->formatDate($model->created_at),
        ];
    }

    public function user($model)
    {
        return $this->hasOne($model, UserSerializer::class);
    }
}
