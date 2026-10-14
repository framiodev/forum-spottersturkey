<?php

/*
 * This file is part of fof/online-users-widget.
 *
 * Copyright (c) 2021 Friends of Flarum.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\OnlineUsers\Extend;

use Flarum\Extend\ExtenderInterface;
use Flarum\Extension\Extension;
use Flarum\Foundation\ContainerUtil;
use Flarum\User\User;
use FoF\OnlineUsers\UserRepository;
use Illuminate\Contracts\Container\Container;

class OnlineUsers implements ExtenderInterface
{
    /** @var array<callable(User): string> */
    private array $cacheKeyParameters = [];

    /**
     * @param (callable(User): string)|string $callable A callable/invokable that returns a string to be used as a cache key parameter.
     */
    public function cacheKeyParameters($callable): self
    {
        $this->cacheKeyParameters[] = $callable;

        return $this;
    }

    public function extend(Container $container, ?Extension $extension = null): void
    {
        foreach ($this->cacheKeyParameters as $parameter) {
            UserRepository::addCacheKeyParameter(ContainerUtil::wrapCallback($parameter, $container));
        }
    }
}
