<?php

/*
 * This file is part of fof/pages.
 *
 * Copyright (c) FriendsOfFlarum.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Framio\Content\Pages\Providers;

use Flarum\Formatter\Formatter;
use Flarum\Foundation\AbstractServiceProvider;
use Flarum\Foundation\Paths;
use Framio\Content\Pages\Access\ScopePageVisibility;
use Framio\Content\Pages\Page;

class PageServiceProvider extends AbstractServiceProvider
{
    public function boot(): void
    {
        $this->container->instance('path.pages', $this->container->make(Paths::class)->base.DIRECTORY_SEPARATOR.'pages');

        Page::setFormatter($this->container->make(Formatter::class));
        Page::registerVisibilityScoper(new ScopePageVisibility(), 'view');
    }
}
