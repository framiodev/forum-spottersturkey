<?php

/*
 * This file is part of fof/pwa
 *
 * Copyright (c) 2021 Alexander Skvortsov.
 * Copyright (c) 2025 FriendsOfFlarum
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

namespace Framio\PWA;

use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Filesystem\Cloud;
use Illuminate\Contracts\Filesystem\Factory;

trait PWATrait
{
    /**
     * @return string
     */
    protected function getBasePath(): string
    {
        /** @var UrlGenerator $url */
        $url = resolve(UrlGenerator::class);

        return rtrim(parse_url($url->to('forum')->base(), PHP_URL_PATH) ?? '/', '/').'/';
    }

    /**
     * @return array<array{'src': string, 'sizes': string, 'type': string}>
     */
    protected function getIcons(): array
    {
        /** @var Cloud $assetsFilesystem */
        $assetsFilesystem = resolve(Factory::class)->disk('flarum-assets');
        $settings = resolve(SettingsRepositoryInterface::class);

        $icons = [];
        foreach (IconSize::cases() as $size) {
            if ($path = $settings->get($size->getSettingsKey())) {
                $icons[] = [
                    'src'   => $assetsFilesystem->url($path),
                    'sizes' => "{$size->value}x{$size->value}",
                    'type'  => 'image/png',
                ];
            }
        }

        return $icons;
    }

    protected function buildManifest(): array
    {
        /** @var SettingsRepositoryInterface $settings */
        $settings = resolve(SettingsRepositoryInterface::class);

        $basePath = $this->getBasePath();
        $manifest = [
            'name'        => $settings->get('fof-pwa.longName') ?: $settings->get('forum_title'),
            'description' => $settings->get('forum_description', ''),
            //"categories" => $settings->get('fof-pwa.categories', []),
            'start_url'   => $basePath,
            'scope'       => $basePath,
            'dir'         => 'auto',
            'theme_color' => $settings->get('fof-pwa.themeColor') ?: $settings->get('theme_primary_color'),
            'display'     => 'standalone',
            'icons'       => $this->getIcons(),
        ];

        if ($backgroundColor = $settings->get('fof-pwa.backgroundColor')) {
            $manifest['background_color'] = $backgroundColor;
        }

        if ($settings->get('fof-pwa.forcePortrait')) {
            $manifest['orientation'] = 'portrait';
        }

        $shortName = $settings->get('fof-pwa.shortName');
        if ($shortName) {
            $manifest['short_name'] = $shortName;
        }

        // Uygulama simgesine basılı tutunca: Framio Asistan kısayolu (asistan açıksa)
        if ($settings->get('framio-upload-exif.assistant_enabled') !== '0') {
            $manifest['shortcuts'] = [[
                'name' => 'Asistan',
                'short_name' => 'Asistan',
                'description' => 'Sesli ya da yazılı komutla fotoğraf bul ve paylaş',
                'url' => rtrim($basePath, '/') . '/?asistan=1',
                'icons' => array_slice($manifest['icons'], 0, 1),
            ]];
        }

        $displayOverride = $settings->get('fof-pwa.windowControlsOverlay');
        if ($displayOverride) {
            $manifest['display_override'] = ['window-controls-overlay'];
        }

        return $manifest;
    }
}
