<?php

declare(strict_types=1);

namespace forumaker\Friendship\Support;

use Flarum\User\User;

class UserDisplayHelper
{
    /**
     * Resolves the name to show for a user: display_name falls back to
     * username, and a placeholder is used when the user no longer exists.
     */
    public static function resolve(?User $user, ?int $fallbackId = null): ?string
    {
        if (! $user) {
            return $fallbackId !== null ? "#{$fallbackId}" : null;
        }

        return $user->display_name ?: $user->username;
    }
}
