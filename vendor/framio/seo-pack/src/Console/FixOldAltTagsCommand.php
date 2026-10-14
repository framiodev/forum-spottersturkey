<?php

namespace Framio\SeoPack\Console;

use Flarum\Console\AbstractCommand;
use Framio\SeoPack\FixAltTagsController;
use Framio\SeoPack\Support\AltTextFixer;
use Framio\SeoPack\Support\SeoSettings;
use Symfony\Component\Console\Input\InputOption;

class FixOldAltTagsCommand extends AbstractCommand
{
    public function __construct(protected AltTextFixer $fixer, protected SeoSettings $seo)
    {
        parent::__construct();
    }

    protected function configure()
    {
        $this->setName('seo:fix-old-alt')
            ->setDescription('Tanınan medya etiketlerindeki boş alt metinleri künyeden doldurur.')
            ->addOption('overwrite', null, InputOption::VALUE_NONE, 'Dolu alt metinlerin de üzerine yaz');
    }

    protected function fire(): int
    {
        $overwrite = (bool) $this->input->getOption('overwrite');
        $this->info('Mesajlar taranıyor' . ($overwrite ? ' (mevcut alt metinlerin üzerine yazılacak)' : '') . '...');

        [$processed, $updated] = FixAltTagsController::run($this->fixer, $this->seo, $overwrite, function ($p, $u) {
            $this->info("{$p} mesaj kontrol edildi, {$u} güncellendi...");
        });

        $this->info("İşlem tamamlandı: {$processed} mesaj tarandı, {$updated} mesaj güncellendi.");

        return 0;
    }
}
