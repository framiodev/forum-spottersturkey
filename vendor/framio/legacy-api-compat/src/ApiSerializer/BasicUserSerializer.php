<?php

namespace Flarum\Api\Serializer;

use Flarum\Http\SlugManager;
use Flarum\User\User;
use InvalidArgumentException;

class BasicUserSerializer extends AbstractSerializer
{
    protected $type = 'users';

    protected SlugManager $slugManager;

    public function __construct(SlugManager $slugManager)
    {
        $this->slugManager = $slugManager;
    }

    protected function getDefaultAttributes($user)
    {
        if (! ($user instanceof User)) {
            throw new InvalidArgumentException(
                get_class($this).' can only serialize instances of '.User::class
            );
        }

        return [
            'username' => $user->username,
            'displayName' => $user->display_name,
            'avatarUrl' => $user->avatar_url,
            'slug' => $this->slugManager->forResource(User::class)->toSlug($user),
        ];
    }
}
