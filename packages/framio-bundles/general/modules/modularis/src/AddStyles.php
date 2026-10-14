<?php

namespace Stezkoy\FlarumModularis;

use Flarum\Frontend\Document;
use Illuminate\Contracts\Cache\Repository as Cache;

abstract class AddStyles
{
    public function __construct(
        protected readonly Cache $cache,
        protected readonly CacheRebuilder $rebuilder,
    ) {}

    protected function render(Document $document, string $scope): void
    {
        $styles = $this->cache->get(Style::cacheKey($scope));

        if ($styles === null) {
            // Cold cache miss — rebuild synchronously, then read back.
            $this->rebuilder->rebuild();
            $styles = $this->cache->get(Style::cacheKey($scope)) ?? [];
        }

        if (count($styles) === 0) {
            return;
        }

        foreach ($styles as $style) {
            $css = (string) $style['css'];

            // Defence-in-depth: never emit a style that could break out of the
            // <style> tag (e.g. a row written directly to the DB, bypassing the
            // API validation). Any raw '<' is treated as unsafe.
            if ($css === '' || str_contains($css, '<')) {
                continue;
            }

            $document->head[] = '<style id="modularis-' . e($scope)
                . '-' . e((string) ($style['id'] ?? $style['name'])) . '">'
                . $css . '</style>';
        }
    }
}
