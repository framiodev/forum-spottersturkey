<?php

namespace Framio\SeoPack\Console;

use Flarum\Console\AbstractCommand;
use Framio\SeoPack\Support\EntityIndex;

class IndexEntitiesCommand extends AbstractCommand
{
    public function __construct(protected EntityIndex $index)
    {
        parent::__construct();
    }

    protected function configure()
    {
        $this->setName('seo:index-entities')
            ->setDescription('Künye dizinini (marka, model, firma, plaka) tüm mesajlardan yeniden oluşturur.');
    }

    protected function fire(): int
    {
        $this->info('Künye dizini oluşturuluyor...');
        $count = $this->index->rebuild(fn ($n) => $this->info("{$n} mesaj işlendi..."));
        $this->info("Tamamlandı: {$count} mesaj tarandı.");

        return 0;
    }
}
