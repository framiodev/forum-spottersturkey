<?php

namespace Framio\PackageManager\Services;

use Flarum\Foundation\Paths;
use Illuminate\Database\ConnectionInterface;

class BundleManager
{
    private Paths $paths;
    private ConnectionInterface $db;
    private PackageDownloader $downloader;
    private PackagistClient $packagistClient;

    public function __construct(
        Paths $paths,
        ConnectionInterface $db,
        PackageDownloader $downloader,
        PackagistClient $packagistClient
    ) {
        $this->paths = $paths;
        $this->db = $db;
        $this->downloader = $downloader;
        $this->packagistClient = $packagistClient;
    }

    /**
     * Tüm packages/ dizinini tarar, konsolide paketleri (alt modülleriyle)
     * ve izole eklentileri ayıklar.
     */
    public function getOverview(): array
    {
        $packagesDir = $this->paths->base . '/packages';
        if (!is_dir($packagesDir)) {
            return ['bundles' => [], 'isolated' => []];
        }

        // DB'den tüm modül ayarlarını çek
        $settings = $this->db->table('settings')
            ->where('key', 'LIKE', 'framio.module.%.enabled')
            ->pluck('value', 'key')
            ->toArray();

        $bundles = [];
        $isolated = [];

        $items = array_diff(scandir($packagesDir), ['.', '..']);
        foreach ($items as $item) {
            $itemPath = $packagesDir . '/' . $item;
            if (!is_dir($itemPath) || $item === 'common') {
                continue;
            }

            $composerJsonPath = $itemPath . '/composer.json';
            $composerData = file_exists($composerJsonPath) ? json_decode(file_get_contents($composerJsonPath), true) : [];
            $modulesDir = $itemPath . '/modules';

            // Konsolide Paket mi? (modules dizini var mı?)
            if (is_dir($modulesDir)) {
                $modules = [];
                $modItems = array_diff(scandir($modulesDir), ['.', '..']);

                foreach ($modItems as $modItem) {
                    $modPath = $modulesDir . '/' . $modItem;
                    if (!is_dir($modPath)) {
                        continue;
                    }

                    $settingKey = "framio.module.{$modItem}.enabled";
                    $enabled = true; // varsayılan aktif
                    if (array_key_exists($settingKey, $settings)) {
                        $enabled = ($settings[$settingKey] === '1' || $settings[$settingKey] === 1 || $settings[$settingKey] === true);
                    }

                    $modComposerPath = $modPath . '/composer.json';
                    $modComposer = file_exists($modComposerPath) ? json_decode(file_get_contents($modComposerPath), true) : [];

                    // Meta bilgilerini al (.framio-meta.json veya auto-detect)
                    $meta = $this->getModuleMeta($item, $modItem, $composerData, $modComposer);

                    $modTitle = $modComposer['extra']['flarum-extension']['title'] ?? ucwords(str_replace(['-', '_'], ' ', $modItem));
                    $modDesc = $modComposer['description'] ?? 'Framio konsolide alt modülü.';
                    $modVersion = $meta['installed_version'] ?? ($modComposer['version'] ?? '1.0.0');
                    $modIcon = $modComposer['extra']['flarum-extension']['icon'] ?? [
                        'name' => 'fas fa-puzzle-piece',
                        'backgroundColor' => '#4D698E',
                        'color' => '#fff'
                    ];

                    $modules[] = [
                        'key' => $modItem,
                        'name' => $modItem,
                        'bundle' => $item,
                        'title' => $modTitle,
                        'description' => $modDesc,
                        'version' => $modVersion,
                        'icon' => $modIcon,
                        'enabled' => $enabled,
                        'original_package' => $meta['original_package'] ?? null,
                        'latest_version' => $meta['latest_version'] ?? null,
                        'has_update' => $meta['has_update'] ?? false,
                        'path' => "packages/{$item}/modules/{$modItem}",
                    ];
                }

                $bundles[] = [
                    'id' => $item,
                    'name' => $composerData['name'] ?? "framio/{$item}",
                    'title' => $composerData['extra']['flarum-extension']['title'] ?? ucwords(str_replace(['-', '_'], ' ', $item)),
                    'description' => $composerData['description'] ?? 'Framio konsolide paket.',
                    'version' => $composerData['version'] ?? '1.0.0',
                    'icon' => $composerData['extra']['flarum-extension']['icon'] ?? [
                        'name' => 'fas fa-box-archive',
                        'backgroundColor' => '#0b5c4e',
                        'color' => '#fff'
                    ],
                    'path' => "packages/{$item}",
                    'modules' => $modules,
                ];
            } else {
                // İzole / Bağımsız Paket
                $isolated[] = [
                    'id' => $item,
                    'name' => $composerData['name'] ?? "framio/{$item}",
                    'title' => $composerData['extra']['flarum-extension']['title'] ?? ucwords(str_replace(['-', '_'], ' ', $item)),
                    'description' => $composerData['description'] ?? 'Bağımsız özel Flarum eklentisi.',
                    'version' => $composerData['version'] ?? '1.0.0',
                    'icon' => $composerData['extra']['flarum-extension']['icon'] ?? [
                        'name' => 'fas fa-shield-alt',
                        'backgroundColor' => '#198754',
                        'color' => '#fff'
                    ],
                    'authors' => $composerData['authors'] ?? [],
                    'path' => "packages/{$item}",
                ];
            }
        }

        return [
            'bundles' => $bundles,
            'isolated' => $isolated,
        ];
    }

    /**
     * Modül metadata bilgilerini getirir (.framio-meta.json veya otomatik tespit).
     */
    public function getModuleMeta(string $bundle, string $module, ?array $bundleComposer = null, ?array $modComposer = null): array
    {
        $modPath = $this->paths->base . "/packages/{$bundle}/modules/{$module}";
        $metaPath = $modPath . '/.framio-meta.json';

        $meta = [];
        if (file_exists($metaPath)) {
            $meta = json_decode(file_get_contents($metaPath), true) ?: [];
        }

        if (empty($meta['original_package'])) {
            if ($bundleComposer === null) {
                $bComposerPath = $this->paths->base . "/packages/{$bundle}/composer.json";
                $bundleComposer = file_exists($bComposerPath) ? json_decode(file_get_contents($bComposerPath), true) : [];
            }
            if ($modComposer === null) {
                $mComposerPath = $modPath . '/composer.json';
                $modComposer = file_exists($mComposerPath) ? json_decode(file_get_contents($mComposerPath), true) : [];
            }

            $detected = $this->detectOriginalPackage($bundle, $module, $bundleComposer, $modComposer);
            if ($detected) {
                $meta['original_package'] = $detected;
            }
        }

        if (empty($meta['installed_version'])) {
            $meta['installed_version'] = $modComposer['version'] ?? '1.0.0';
        }

        return $meta;
    }

    /**
     * Modül metadata bilgilerini günceller/kaydeder.
     */
    public function setModuleMeta(string $bundle, string $module, string $originalPackage, ?string $version = null): array
    {
        $modPath = $this->paths->base . "/packages/{$bundle}/modules/{$module}";
        if (!is_dir($modPath)) {
            throw new \RuntimeException("Modül klasörü bulunamadı: {$module}");
        }

        $metaPath = $modPath . '/.framio-meta.json';
        $meta = file_exists($metaPath) ? json_decode(file_get_contents($metaPath), true) : [];

        $meta['original_package'] = strtolower(trim($originalPackage));
        if ($version) {
            $meta['installed_version'] = trim($version);
        } elseif (empty($meta['installed_version'])) {
            $meta['installed_version'] = '1.0.0';
        }
        $meta['updated_at'] = date('c');

        file_put_contents($metaPath, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return $meta;
    }

    /**
     * Otomatik Orijinal Paket Adı Tespiti.
     * Modülün PSR-4 namespace'lerinden veya bilinen haritalardan Packagist adını çözer.
     */
    private function detectOriginalPackage(string $bundle, string $module, array $bundleComposer, array $modComposer): ?string
    {
        // 1. Modülün kendi composer.json dosyasındaki "name" framio değilse:
        if (!empty($modComposer['name']) && !str_starts_with($modComposer['name'], 'framio/')) {
            return $modComposer['name'];
        }

        // 2. Bilinen kesin eşleşmeler (knownMap)
        $knownMap = [
            'forum-statistics-widget' => 'fof/forum-statistics-widget',
            'forum-widgets-core' => 'fof/forum-widgets-core',
            'frontpage' => 'fof/frontpage',
            'socialcards' => 'justoverclock/flarum-ext-socialcards',
            'online-users-widget' => 'fof/online-users-widget',
            'top-posters-widget' => 'fof/top-posters-widget',
            'news-widget' => 'fof/news-widget',
            'polls' => 'fof/polls',
            'reactions' => 'fof/reactions',
            'bookmarks' => 'fof/gamification',
            'drafts' => 'fof/drafts',
            'formatting' => 'fof/formatting',
            'links' => 'fof/links',
            'pages' => 'fof/pages',
            'user-directory' => 'fof/user-directory',
            'follow-tags' => 'fof/follow-tags',
            'subscribed' => 'fof/subscribed',
            'ignore-users' => 'fof/ignore-users',
            'default-user-preferences' => 'fof/default-user-preferences',
            'masquerade' => 'fof/masquerade',
            'user-bio' => 'fof/user-bio',
            'oauth' => 'fof/oauth',
            'share-social' => 'fof/share-social',
            'who-read' => 'fof/who-read',
            'discussion-views' => 'fof/discussion-views',
            'badges' => 'v17development/flarum-badges',
            'socialprofile' => 'justoverclock/flarum-ext-socialprofile',
            'pwned-passwords' => 'fof/pwned-passwords',
            'recaptcha' => 'fof/recaptcha',
            'author-change' => 'clarkwinkelmann/flarum-ext-author-change',
            'merge-discussions' => 'fof/merge-discussions',
            'moderator-notes' => 'fof/moderator-notes',
            'moderator-warnings' => 'fof/moderator-warnings',
        ];

        if (array_key_exists($module, $knownMap)) {
            return $knownMap[$module];
        }

        // 3. Ana paketin PSR-4 namespace haritasını incele (Yedek Çıkarım)
        $psr4 = $bundleComposer['autoload']['psr-4'] ?? [];
        foreach ($psr4 as $namespace => $relPath) {
            if (str_contains($relPath, "modules/{$module}/")) {
                $ns = trim($namespace, '\\');
                $parts = explode('\\', $ns);
                $vendor = strtolower($parts[0] ?? '');
                $pkg = $parts[1] ?? '';

                if ($vendor === 'fof' && !empty($pkg)) {
                    $slug = strtolower(preg_replace('/(?<!^)[A-Z]/', '-$0', $pkg));
                    return "fof/{$slug}";
                }
                if ($vendor === 'justoverclock' && !empty($pkg)) {
                    $slug = strtolower(preg_replace('/(?<!^)[A-Z]/', '-$0', $pkg));
                    return "justoverclock/flarum-ext-{$slug}";
                }
                if ($vendor === 'clarkwinkelmann' && !empty($pkg)) {
                    $slug = strtolower(preg_replace('/(?<!^)[A-Z]/', '-$0', $pkg));
                    return "clarkwinkelmann/flarum-ext-{$slug}";
                }
                if ($vendor === 'v17development' && !empty($pkg)) {
                    $slug = strtolower(preg_replace('/(?<!^)[A-Z]/', '-$0', $pkg));
                    return "v17development/flarum-{$slug}";
                }
            }
        }

        return null;
    }

    /**
     * Tek bir modül için Packagist üzerinden güncelleme denetimi yapar.
     */
    public function checkModuleUpdate(string $bundle, string $module): array
    {
        $meta = $this->getModuleMeta($bundle, $module);
        $originalPackage = $meta['original_package'] ?? null;
        $installedVersion = ltrim($meta['installed_version'] ?? '1.0.0', 'v');

        if (!$originalPackage) {
            return [
                'has_update' => false,
                'current_version' => $installedVersion,
                'latest_version' => null,
                'original_package' => null,
                'message' => 'Orijinal paket kaynağı tanımlı değil.'
            ];
        }

        $details = $this->packagistClient->getPackageDetails($originalPackage);
        if (!$details) {
            return [
                'has_update' => false,
                'current_version' => $installedVersion,
                'latest_version' => null,
                'original_package' => $originalPackage,
                'message' => 'Packagist üzerinde paket bilgisi bulunamadı.'
            ];
        }

        $latestVersion = ltrim($details['version'] ?? '', 'v');
        $hasUpdate = !empty($latestVersion) && version_compare($latestVersion, $installedVersion, '>');

        // Sonucu metadata dosyasına da kaydet
        $modPath = $this->paths->base . "/packages/{$bundle}/modules/{$module}";
        $metaPath = $modPath . '/.framio-meta.json';
        $meta['latest_version'] = $latestVersion;
        $meta['has_update'] = $hasUpdate;
        $meta['last_checked_at'] = date('c');
        file_put_contents($metaPath, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return [
            'has_update' => $hasUpdate,
            'current_version' => $installedVersion,
            'latest_version' => $latestVersion,
            'original_package' => $originalPackage,
            'description' => $details['description'] ?? '',
        ];
    }

    /**
     * Bir modülü Packagist'teki en son kararlı sürüme günceller.
     * Güvenlik yedeği (snapshot), dosya değişimi, migration ve önbellek adımlarını kapsar.
     */
    public function updateModule(string $bundle, string $module, ?string $targetVersion = null): array
    {
        $meta = $this->getModuleMeta($bundle, $module);
        $originalPackage = $meta['original_package'] ?? null;

        if (!$originalPackage) {
            throw new \RuntimeException("'{$module}' modülü için orijinal Packagist paketi tanımlanmamış.");
        }

        $details = $this->packagistClient->getPackageDetails($originalPackage);
        if (!$details || empty($details['dist']['url'])) {
            throw new \RuntimeException("'{$originalPackage}' için indirilebilir arşiv bulunamadı.");
        }

        $newVersion = ltrim($details['version'] ?? '', 'v');
        $zipUrl = $details['dist']['url'];

        // 1. ZIP dosyasını indir
        $tempZip = $this->downloader->downloadZip($zipUrl);
        if (!$tempZip) {
            throw new \RuntimeException("Yeni sürüm arşivi indirilemedi: {$zipUrl}");
        }

        $modPath = $this->paths->base . "/packages/{$bundle}/modules/{$module}";

        // 2. Güvenlik Yedeği Al (Snapshot)
        $backupDir = $this->paths->storage . "/framio-backups/{$bundle}_{$module}_" . date('Ymd_His');
        if (!is_dir(dirname($backupDir))) {
            mkdir(dirname($backupDir), 0755, true);
        }
        $this->downloader->copyDirectory($modPath, $backupDir);

        try {
            // 3. Modülü temizle ve yeni dosyaları ayıkla
            $this->downloader->extractZip($tempZip, $modPath);

            // 4. .framio-meta.json güncelle
            $meta['original_package'] = $originalPackage;
            $meta['installed_version'] = $newVersion;
            $meta['latest_version'] = $newVersion;
            $meta['has_update'] = false;
            $meta['updated_at'] = date('c');
            file_put_contents($modPath . '/.framio-meta.json', json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            // 5. Yeni migration varsa uygula
            if (is_dir($modPath . '/migrations')) {
                @exec('php ' . escapeshellarg($this->paths->base . '/flarum') . ' migrate');
            }

            // 6. Önbelleği temizle
            @exec('php ' . escapeshellarg($this->paths->base . '/flarum') . ' cache:clear');

            return [
                'status' => 'success',
                'bundle' => $bundle,
                'module' => $module,
                'version' => $newVersion,
                'backup_path' => $backupDir,
                'message' => "'{$module}' modülü v{$newVersion} sürümüne başarıyla güncellendi!"
            ];
        } catch (\Throwable $e) {
            // Hata durumunda yedeği geri yükle (Rollback)
            $this->downloader->copyDirectory($backupDir, $modPath);
            throw new \RuntimeException("Güncelleme başarısız oldu, eski sürüme geri dönüldü: " . $e->getMessage());
        } finally {
            @unlink($tempZip);
        }
    }

    /**
     * Modül aktiflik durumunu günceller.
     */
    public function toggleModule(string $key, bool $enabled): void
    {
        $settingKey = "framio.module.{$key}.enabled";
        $value = $enabled ? '1' : '0';

        $exists = $this->db->table('settings')->where('key', $settingKey)->exists();
        if ($exists) {
            $this->db->table('settings')->where('key', $settingKey)->update(['value' => $value]);
        } else {
            $this->db->table('settings')->insert(['key' => $settingKey, 'value' => $value]);
        }
    }

    /**
     * Sıfırdan yeni bir konsolide paket (Bundle) oluşturur.
     */
    public function createBundle(string $name, string $title, string $description, string $iconName = 'fas fa-cubes', string $iconBg = '#0b5c4e'): array
    {
        $slug = strtolower(preg_replace('/[^a-z0-9\-_]/', '', str_replace(' ', '-', $name)));
        $bundleDir = $this->paths->base . "/packages/{$slug}";

        if (is_dir($bundleDir)) {
            throw new \RuntimeException("Bu isimde bir paket zaten mevcut: {$slug}");
        }

        mkdir($bundleDir, 0755, true);
        mkdir($bundleDir . '/modules', 0755, true);
        mkdir($bundleDir . '/resources/less', 0755, true);
        mkdir($bundleDir . '/locale', 0755, true);

        // composer.json
        $composer = [
            'name' => "framio/{$slug}",
            'description' => $description ?: "Framio {$title} konsolide paketi.",
            'type' => 'flarum-extension',
            'version' => '1.0.0',
            'license' => 'MIT',
            'authors' => [
                [
                    'name' => 'Framio-Dev',
                    'homepage' => 'https://dev.framiomedia.com'
                ]
            ],
            'require' => [
                'flarum/core' => '^2.0'
            ],
            'autoload' => [
                'psr-4' => [
                    'Framio\\' . ucfirst(str_replace('-', '', $slug)) . '\\' => 'src/'
                ]
            ],
            'extra' => [
                'flarum-extension' => [
                    'title' => $title ?: "Framio {$slug}",
                    'category' => 'feature',
                    'icon' => [
                        'name' => $iconName ?: 'fas fa-cubes',
                        'backgroundColor' => $iconBg ?: '#0b5c4e',
                        'color' => '#fff'
                    ]
                ]
            ]
        ];

        file_put_contents($bundleDir . '/composer.json', json_encode($composer, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

        // extend.php
        $extendContent = "<?php\n\n/*\n * framio/{$slug} — Konsolide eklenti paketi.\n */\n\nuse Flarum\\Extend;\n\nrequire_once dirname(__DIR__).'/common/ModuleManager.php';\nuse Framio\\Common\\ModuleManager;\n\nreturn [\n    // Konsolide modüller buraya dinamik eklenir\n];\n";
        file_put_contents($bundleDir . '/extend.php', $extendContent);

        // admin.less
        file_put_contents($bundleDir . '/resources/less/admin.less', "/* framio/{$slug} styles */\n");

        // tr.yml
        file_put_contents($bundleDir . '/locale/tr.yml', "framio-{$slug}:\n  admin:\n    title: \"{$title}\"\n");

        // root composer.json'a require ekle
        $this->addPackageToRootComposer("framio/{$slug}");

        return [
            'id' => $slug,
            'name' => "framio/{$slug}",
            'title' => $title,
            'path' => "packages/{$slug}"
        ];
    }

    /**
     * İndirilen bir eklentiyi mevcut bir konsolide pakete (Bundle) modül olarak entegre eder.
     */
    public function consolidateExtension(string $zipPath, string $targetBundle, string $moduleKey, string $moduleTitle, ?string $originalPackage = null, ?string $version = null): array
    {
        $targetBundle = trim(str_replace('packages/', '', $targetBundle), '/');
        $moduleKey = strtolower(preg_replace('/[^a-z0-9\-_]/', '', str_replace(' ', '-', $moduleKey)));

        $bundleDir = $this->paths->base . "/packages/{$targetBundle}";
        if (!is_dir($bundleDir)) {
            throw new \RuntimeException("Hedef konsolide paket bulunamadı: {$targetBundle}");
        }

        $moduleDir = $bundleDir . "/modules/{$moduleKey}";
        if (is_dir($moduleDir)) {
            $this->downloader->deleteDirectory($moduleDir);
        }

        // ZIP'i modül klasörüne çıkar
        $extracted = $this->downloader->extractZip($zipPath, $moduleDir);
        if (!$extracted) {
            throw new \RuntimeException("Eklenti dosyaları arşive açılamadı.");
        }

        // Modülün composer.json'ını oku ve PSR-4 namespace'lerini ana pakete tanıt
        $modComposerPath = $moduleDir . '/composer.json';
        if (file_exists($modComposerPath)) {
            $modComposer = json_decode(file_get_contents($modComposerPath), true);
            $psr4 = $modComposer['autoload']['psr-4'] ?? [];

            $bundleComposerPath = $bundleDir . '/composer.json';
            if (file_exists($bundleComposerPath) && !empty($psr4)) {
                $bundleComposer = json_decode(file_get_contents($bundleComposerPath), true);
                if (!isset($bundleComposer['autoload']['psr-4'])) {
                    $bundleComposer['autoload']['psr-4'] = [];
                }
                foreach ($psr4 as $ns => $relPath) {
                    $cleanRel = trim($relPath, '/');
                    $bundleComposer['autoload']['psr-4'][$ns] = "modules/{$moduleKey}/" . ($cleanRel ? $cleanRel . '/' : '');
                }
                file_put_contents($bundleComposerPath, json_encode($bundleComposer, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            }
        }

        // Metadata dosyasını kaydet (.framio-meta.json)
        if ($originalPackage) {
            $this->setModuleMeta($targetBundle, $moduleKey, $originalPackage, $version ?: '1.0.0');
        }

        // Hedef paketin extend.php dosyasına ModuleManager::conditional satırını ekle
        $extendFile = $bundleDir . '/extend.php';
        if (file_exists($extendFile)) {
            $extendContent = file_get_contents($extendFile);
            $conditionalLine = "    ...ModuleManager::conditional('{$moduleKey}', require __DIR__.'/modules/{$moduleKey}/extend.php'),";

            if (!str_contains($extendContent, "conditional('{$moduleKey}'")) {
                if (preg_match('/return\s*\[\s*/', $extendContent, $matches, PREG_OFFSET_CAPTURE)) {
                    $insertPos = $matches[0][1] + strlen($matches[0][0]);
                    $extendContent = substr_replace($extendContent, "\n" . $conditionalLine . "\n", $insertPos, 0);
                    file_put_contents($extendFile, $extendContent);
                }
            }
        }

        // Veritabanında modülü varsayılan olarak etkinleştir
        $this->toggleModule($moduleKey, true);

        return [
            'bundle' => $targetBundle,
            'module' => $moduleKey,
            'title' => $moduleTitle,
            'status' => 'success'
        ];
    }

    /**
     * İndirilen bir eklentiyi tamamen özelleştirilmiş kimlikle bağımsız/izole bir paket olarak kurar.
     */
    public function installIsolatedExtension(string $zipPath, array $identity): array
    {
        $pkgSlug = strtolower(preg_replace('/[^a-z0-9\-_]/', '', str_replace(['framio/', ' '], ['', '-'], $identity['package_name'] ?? 'custom-extension')));
        if (empty($pkgSlug)) {
            $pkgSlug = 'custom-ext-' . substr(md5(uniqid()), 0, 6);
        }

        $targetDir = $this->paths->base . "/packages/{$pkgSlug}";
        if (is_dir($targetDir)) {
            $this->downloader->deleteDirectory($targetDir);
        }

        // ZIP'i çıkar
        $extracted = $this->downloader->extractZip($zipPath, $targetDir);
        if (!$extracted) {
            throw new \RuntimeException("Eklenti arşivden çıkarılamadı.");
        }

        // composer.json dosyasını oku ve özelleştirilmiş kimlikle baştan yaz
        $composerPath = $targetDir . '/composer.json';
        $originalComposer = file_exists($composerPath) ? json_decode(file_get_contents($composerPath), true) : [];

        $packageName = "framio/{$pkgSlug}";
        $customTitle = !empty($identity['title']) ? $identity['title'] : ($originalComposer['extra']['flarum-extension']['title'] ?? ucwords($pkgSlug));
        $customDesc = !empty($identity['description']) ? $identity['description'] : ($originalComposer['description'] ?? 'Framio izole eklentisi.');
        $customVersion = !empty($identity['version']) ? $identity['version'] : ($originalComposer['version'] ?? '1.0.0');
        $customAuthor = !empty($identity['author']) ? $identity['author'] : 'Framio-Dev';
        $iconName = !empty($identity['icon_name']) ? $identity['icon_name'] : ($originalComposer['extra']['flarum-extension']['icon']['name'] ?? 'fas fa-puzzle-piece');
        $iconBg = !empty($identity['icon_bg']) ? $identity['icon_bg'] : ($originalComposer['extra']['flarum-extension']['icon']['backgroundColor'] ?? '#0b5c4e');
        $iconColor = !empty($identity['icon_color']) ? $identity['icon_color'] : '#ffffff';

        $mergedComposer = $originalComposer;
        $mergedComposer['name'] = $packageName;
        $mergedComposer['version'] = $customVersion;
        $mergedComposer['description'] = $customDesc;
        $mergedComposer['authors'] = [
            [
                'name' => $customAuthor,
                'homepage' => 'https://dev.framiomedia.com'
            ]
        ];
        if (!isset($mergedComposer['extra'])) {
            $mergedComposer['extra'] = [];
        }
        $mergedComposer['extra']['flarum-extension'] = array_merge($mergedComposer['extra']['flarum-extension'] ?? [], [
            'title' => $customTitle,
            'category' => $originalComposer['extra']['flarum-extension']['category'] ?? 'feature',
            'icon' => [
                'name' => $iconName,
                'backgroundColor' => $iconBg,
                'color' => $iconColor
            ]
        ]);

        file_put_contents($composerPath, json_encode($mergedComposer, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

        // Kök composer.json dosyasına ekle
        $this->addPackageToRootComposer($packageName);

        return [
            'package_name' => $packageName,
            'slug' => $pkgSlug,
            'title' => $customTitle,
            'version' => $customVersion,
            'path' => "packages/{$pkgSlug}",
            'status' => 'success'
        ];
    }

    /**
     * Kök composer.json dosyasına require olarak paketi ekler.
     */
    public function addPackageToRootComposer(string $packageName): void
    {
        $rootComposerPath = $this->paths->base . '/composer.json';
        if (!file_exists($rootComposerPath)) {
            return;
        }

        $rootJson = json_decode(file_get_contents($rootComposerPath), true);
        if (!isset($rootJson['require'][$packageName])) {
            $rootJson['require'][$packageName] = '*';
            // Alfabetik sırala
            ksort($rootJson['require']);
            file_put_contents($rootComposerPath, json_encode($rootJson, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }
    }

    /**
     * Modülü konsolide paketten kaldırır.
     */
    public function deleteModule(string $bundle, string $module): void
    {
        $bundleDir = $this->paths->base . "/packages/{$bundle}";
        $moduleDir = $bundleDir . "/modules/{$module}";

        if (is_dir($moduleDir)) {
            $this->downloader->deleteDirectory($moduleDir);
        }

        // extend.php'den satırı çıkar
        $extendFile = $bundleDir . '/extend.php';
        if (file_exists($extendFile)) {
            $lines = file($extendFile);
            $newLines = [];
            foreach ($lines as $line) {
                if (!str_contains($line, "conditional('{$module}'")) {
                    $newLines[] = $line;
                }
            }
            file_put_contents($extendFile, implode('', $newLines));
        }

        // Ayar tablosundan kaldır
        $this->db->table('settings')->where('key', "framio.module.{$module}.enabled")->delete();
    }
}
