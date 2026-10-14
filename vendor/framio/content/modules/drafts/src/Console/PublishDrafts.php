<?php

/*
 * This file is part of fof/drafts.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Framio\Content\Drafts\Console;

use Flarum\Console\AbstractCommand;
use Framio\Content\Drafts\DraftPublisher;

class PublishDrafts extends AbstractCommand
{
    public function __construct(protected DraftPublisher $publisher)
    {
        parent::__construct();
    }

    /**
     * {@inheritdoc}
     */
    protected function configure()
    {
        $this
            ->setName('drafts:publish')
            ->setDescription('Publish all scheduled drafts.');
    }

    /**
     * {@inheritdoc}
     */
    protected function fire(): int
    {
        $this->info('Starting...');

        $count = $this->publisher->publishDueDrafts();

        $this->info("Done. Published {$count} drafts.");

        return AbstractCommand::SUCCESS;
    }
}
