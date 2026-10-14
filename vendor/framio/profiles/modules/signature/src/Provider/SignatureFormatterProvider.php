<?php

namespace Framio\Profiles\Signature\Provider;

use Flarum\Extension\ExtensionManager;
use Flarum\Foundation\AbstractServiceProvider;
use Flarum\Foundation\Paths;
use Illuminate\Cache\Repository;
use Illuminate\Contracts\Container\Container;
use Framio\Profiles\Signature\Formatter\SignatureFormatter;

class SignatureFormatterProvider extends AbstractServiceProvider
{
    public function register(): void
    {
        $this->container->singleton('gtdxyz-signature.formatter', function (Container $container) {
            return self::createFormatterInstance($container);
        });

        $this->container->alias('gtdxyz-signature.formatter', SignatureFormatter::class);
    }

    public static function createFormatterInstance(Container $container): SignatureFormatter
    {
        return new SignatureFormatter(
            new Repository($container->make('cache.filestore')),
            $container[Paths::class]->storage.'/formatter',
            $container->make(ExtensionManager::class)
        );
    }
}