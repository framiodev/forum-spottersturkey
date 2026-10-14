<?php

declare(strict_types=1);

namespace forumaker\Friendship;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per user per friendship-related event — the audit trail shown in
 * the «История» view. Symmetric like Friendship: an event between A and B
 * is stored once for A (user_id=A, other_user_id=B) and once for B
 * (user_id=B, other_user_id=A), both pointing at the same actor_id, so a
 * user's history is a plain where(user_id) lookup.
 *
 * @property int $id
 * @property int $user_id
 * @property int $other_user_id
 * @property int $actor_id
 * @property string $action
 * @property Carbon $created_at
 *
 * @property-read User $user
 * @property-read User $otherUser
 * @property-read User $actor
 */
class FriendshipEvent extends AbstractModel
{
    protected $table = 'friendship_events';

    public $timestamps = false;

    protected $fillable = ['user_id', 'other_user_id', 'actor_id', 'action', 'created_at'];

    public const ACTION_REQUESTED = 'requested';
    public const ACTION_CANCELLED = 'cancelled';
    public const ACTION_ACCEPTED = 'accepted';
    public const ACTION_DECLINED = 'declined';
    public const ACTION_REMOVED = 'removed';

    protected $casts = [
        'user_id' => 'integer',
        'other_user_id' => 'integer',
        'actor_id' => 'integer',
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function otherUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'other_user_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
