<?php

namespace Framio\Profiles\Signature\Formatter;

use Flarum\Extension\ExtensionManager;
use Flarum\Formatter\Formatter;
use Illuminate\Cache\Repository;

class SignatureFormatter extends Formatter
{
    /**
     * @var ExtensionManager
     */
    protected $extensions;

    public function __construct(Repository $repository, string $cacheDir, ExtensionManager $extensions)
    {
        parent::__construct($repository, $cacheDir);

        $this->extensions = $extensions;
    }

    protected function getComponent(string $name): mixed
    {
        $formatter = $this->cache->rememberForever('gtdxyz-signature.formatter', function () {
            return $this->getConfigurator()->finalize();
        });

        return $formatter[$name];
    }

    protected function getParser(mixed $context = null): \s9e\TextFormatter\Parser
    {
        $parser = parent::getParser($context);

        $parser->disableTag('IFRAME');
        $parser->disableTag('EMBED');

        return $parser;
    }

    protected function getConfigurator(): \s9e\TextFormatter\Configurator
    {
        $configurator = parent::getConfigurator();

        if ($this->extensions->isEnabled('flarum-markdown')) {
            /** @phpstan-ignore-next-line */
            $configurator->Litedown;
        }

        if ($this->extensions->isEnabled('flarum-bbcode')) {
            (new \Flarum\BBCode\Configure())($configurator);
        }

        return $configurator;
    }

    public function flush(): void
    {
        $this->cache->forget('gtdxyz-signature.formatter');
    }
}
