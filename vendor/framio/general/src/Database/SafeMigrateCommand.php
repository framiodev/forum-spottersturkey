<?php

namespace Framio\General\Database;

use Flarum\Console\AbstractCommand;
use Flarum\Database\Console\MigrateCommand;
use Flarum\Database\MigrationRepositoryInterface;
use Flarum\Extension\ExtensionManager;
use Flarum\Foundation\Application;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Container\Container;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Schema\Builder;
use Illuminate\Filesystem\Filesystem;

/**
 * php flarum framio:migrate
 *
 * Çekirdeğin migrate komutuyla aynı sırayla çekirdek ve etkin eklenti göçlerini çalıştırır;
 * eski eklenti adıyla zaten uygulanmış göçleri ("zaten var" hataları) uygulanmış sayıp kaydeder.
 * Bir kez çalıştırıldıktan sonra kayıtlar tamamlanır ve normal `php flarum migrate` de sorunsuz çalışır.
 */
class SafeMigrateCommand extends AbstractCommand
{
    public function __construct(protected Container $container)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('framio:migrate')
            ->setDescription('Göçleri çalıştırır; eski eklenti adıyla zaten uygulanmış göçleri kaydedip devam eder.');
    }

    protected function fire(): int
    {
        $this->container->bind(Builder::class, fn ($c) => $c->make(ConnectionInterface::class)->getSchemaBuilder());

        $migrator = new ResilientMigrator(
            $this->container->make(MigrationRepositoryInterface::class),
            $this->container->make(ConnectionInterface::class),
            $this->container->make(Filesystem::class)
        );
        $migrator->setOutput($this->output);

        $this->info('Migrating Flarum...');
        $coreMigrations = dirname((new \ReflectionClass(MigrateCommand::class))->getFileName(), 4) . '/migrations';
        $migrator->run($coreMigrations);

        $extensions = $this->container->make(ExtensionManager::class);
        if (method_exists($extensions, 'syncExtensionOrder')) {
            $extensions->syncExtensionOrder();
        }

        foreach ($extensions->getEnabledExtensions() as $name => $extension) {
            if ($extension->hasMigrations()) {
                $this->info('Migrating extension: ' . $name);
                $extension->migrate($migrator, 'up');
            }
        }

        $this->container->make(SettingsRepositoryInterface::class)->set('version', Application::VERSION);

        $count = count($migrator->skipped);
        $this->info($count
            ? "Tamamlandı. Eski adla zaten uygulanmış $count göç kaydedildi; bundan sonra normal migrate komutu da çalışır."
            : 'Tamamlandı.');

        return 0;
    }
}
