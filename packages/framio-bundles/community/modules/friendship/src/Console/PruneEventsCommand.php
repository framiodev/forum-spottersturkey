<?php

declare(strict_types=1);

namespace forumaker\Friendship\Console;

use Carbon\Carbon;
use Flarum\Console\AbstractCommand;
use Flarum\Settings\SettingsRepositoryInterface;
use forumaker\Friendship\FriendshipEvent;

/**
 * Deletes friendship_events rows older than the configured retention
 * window. logEvent() writes two rows per action with no cap otherwise, so
 * an active forum's history table grows unboundedly — see extend.php for
 * how this is wired to run daily.
 */
class PruneEventsCommand extends AbstractCommand
{
    protected static $defaultName = 'forumaker-friendship:prune-events';

    public function __construct(
        protected SettingsRepositoryInterface $settings,
    ) {
        parent::__construct();
    }

    protected function configure()
    {
        // Explicit setName() despite $defaultName above — see the identical
        // note in Arena's ExpireBattlesCommand, same Symfony Console quirk.
        $this->setName('forumaker-friendship:prune-events');
        $this->setDescription('Delete friendship history events older than the configured retention window.');
    }

    protected function fire(): int
    {
        $days = (int) $this->settings->get('forumaker-friendship.event_retention_days', 90);

        if ($days <= 0) {
            $this->info('Event retention is disabled (0 days) — nothing pruned.');

            return 0;
        }

        $cutoff = Carbon::now()->subDays($days);
        $deleted = 0;

        // Chunked delete so a large backlog doesn't hold one long-running
        // transaction/lock on the table — same reasoning as the audit's fix
        // suggestion for this finding.
        do {
            $count = FriendshipEvent::where('created_at', '<', $cutoff)->limit(1000)->delete();
            $deleted += $count;
        } while ($count > 0);

        $this->info("Pruned {$deleted} friendship event(s) older than {$days} day(s).");

        return 0;
    }
}
