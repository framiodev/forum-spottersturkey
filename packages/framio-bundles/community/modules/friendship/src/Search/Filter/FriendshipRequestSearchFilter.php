<?php

declare(strict_types=1);

namespace forumaker\Friendship\Search\Filter;

use Flarum\Extension\ExtensionManager;
use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\Search\ValidateFilterTrait;

/**
 * filter[q]=<term> — matches the OTHER party's display name or username.
 * Always run alongside filter[incoming]/filter[outgoing] (which already
 * pins one side of the row to "me"), so an OR across both sender and
 * recipient here still resolves to "the other user" in practice, without
 * this filter needing to know which direction it's combined with — see
 * FriendshipRequestIncomingFilter's docblock for why direction can't be
 * threaded through directly.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class FriendshipRequestSearchFilter implements FilterInterface
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

        // display_name isn't a real column — it's computed by whichever
        // DisplayNameDriver is active (nickname when flarum/nicknames is
        // enabled, username otherwise) — so username/nickname are matched
        // directly instead of filtering on the computed value. The
        // nickname column only exists when that extension is enabled.
        $matchesTerm = function ($q) use ($term) {
            $q->where('username', 'like', "%{$term}%");

            if ($this->extensions->isEnabled('flarum-nicknames')) {
                $q->orWhere('nickname', 'like', "%{$term}%");
            }
        };

        /** @var DatabaseSearchState $state */
        $state->getQuery()->where(function ($query) use ($matchesTerm) {
            $query->whereHas('sender', $matchesTerm)
                ->orWhereHas('recipient', $matchesTerm);
        });
    }
}
