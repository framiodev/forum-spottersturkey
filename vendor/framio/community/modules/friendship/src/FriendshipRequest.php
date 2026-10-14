<?php

declare(strict_types=1);

namespace forumaker\Friendship;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $sender_id
 * @property int $recipient_id
 * @property Carbon $created_at
 *
 * @property-read User $sender
 * @property-read User $recipient
 */
class FriendshipRequest extends AbstractModel
{
    protected $table = 'friendship_requests';

    public $timestamps = false;

    protected $fillable = ['sender_id', 'recipient_id', 'created_at'];

    protected $casts = [
        'sender_id' => 'integer',
        'recipient_id' => 'integer',
        'created_at' => 'datetime',
    ];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }
}
