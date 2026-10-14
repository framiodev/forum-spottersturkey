<?php

namespace Framio\PostComments;

use Flarum\Database\AbstractModel;
use Flarum\Post\Post;
use Flarum\User\User;

/**
 * @property int $id
 * @property int $post_id
 * @property int|null $user_id
 * @property string|null $guest_name
 * @property string $content
 * @property string|null $ip_address
 */
class PostComment extends AbstractModel
{
    protected $table = 'post_comments';

    public $timestamps = true;

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function post()
    {
        return $this->belongsTo(Post::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
