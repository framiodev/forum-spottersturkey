<?php

namespace Stezkoy\FlarumModularis;

use Illuminate\Contracts\Cache\Repository as Cache;

class CacheRebuilder
{
    public function __construct(
        private readonly Cache $cache,
    ) {}

    /**
     * Read all active styles from the database, group them by scope and
     * write one cache key per scope. Called after any create/update/delete,
     * never on the hot request path.
     */
    public function rebuild(): void
    {
        $all = Style::where('active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $byScope = ['forum' => [], 'admin' => []];

        foreach ($all as $style) {
            $scope = in_array($style->scope, Style::VALID_SCOPES, true) ? $style->scope : 'forum';
            $css = trim((string) $style->css);

            if ($css === '') {
                continue;
            }

            $byScope[$scope][] = [
                'id'   => $style->id,
                'name' => $style->name,
                'css'  => $css,
            ];
        }

        foreach (Style::VALID_SCOPES as $scope) {
            $this->cache->forever(Style::cacheKey($scope), $byScope[$scope]);
        }
    }

    public function invalidate(): void
    {
        foreach (Style::cacheKeys() as $key) {
            $this->cache->forget($key);
        }
    }
}
