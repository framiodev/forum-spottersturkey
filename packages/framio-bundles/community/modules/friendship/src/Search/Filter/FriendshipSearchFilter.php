<?php

declare(strict_types=1);

namespace forumaker\Friendship\Search\Filter;

use Flarum\Extension\ExtensionManager;
use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\Search\ValidateFilterTrait;

/**
 * filter[q]=<term> on /api/friendships — matches the friend's username or
 * display name. Always run alongside filter[user] (which already pins the
 * "owner" side of the row), so only the `friend` relation needs matching —
 * unlike FriendshipRequestSearchFilter, there's no ambiguity about which
 * side is "the other party".
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class FriendshipSearchFilter implements FilterInterface
{
    use ValidateFilterTrait;

    public function __construct(protected ExtensionManager $extensions)
    {
    }

    public function getFilterKey(): string
    {
        return 'q';
    }

    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $term = $this->asString($value);

        if ($term === '') {
            return;
        }

        /** @var DatabaseSearchState $state */
        $state->getQuery()->whereHas('friend', function ($q) use ($term) {
            // display_name isn't a real column — see
            // FriendshipRequestSearchFilter's docblock for why
            // username/nickname are matched directly instead.
            $q->where('username', 'like', "%{$term}%");

            if ($this->extensions->isEnabled('flarum-nicknames')) {
                $q->orWhere('nickname', 'like', "%{$term}%");
            }
        });
    }
}
