<?php

declare(strict_types=1);

namespace forumaker\Friendship;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per direction of a confirmed friendship — see the migration
 * comment on why the table is symmetric (two rows per pair).
 *
 * @property int $id
 * @property int $user_id
 * @property int $friend_id
 * @property Carbon $created_at
 *
 * @property-read User $user
 * @property-read User $friend
 */
class Friendship extends AbstractModel
{
    protected $table = 'friendships';

    public $timestamps = false;

    protected $fillable = ['user_id', 'friend_id', 'created_at'];

    protected $casts = [
        'user_id' => 'integer',
        'friend_id' => 'integer',
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function friend(): BelongsTo
    {
        return $this->belongsTo(User::class, 'friend_id');
    }
}
