<?php

namespace Framio\Common;

if (!class_exists(ModuleManager::class)) {
    class ModuleManager
    {
        private static ?array $settings = null;

        /**
         * Veritabanından doğrudan modül durumunu kontrol eder.
         * Flarum henüz boot edilmeden önce Extend aşamasında güvenle çalışır.
         */
        public static function isEnabled(string $key): bool
        {
            if (self::$settings === null) {
                self::$settings = [];
                try {
                    // Site kökündeki config.php: paket derinliği siteye göre değişir
                    // (packages/common, packages/framio-bundles/common, vendor/…)
                    $configFile = '';
                    for ($level = 2; $level <= 6; $level++) {
                        $candidate = dirname(__DIR__, $level) . '/config.php';
                        if (file_exists($candidate) && file_exists(dirname($candidate) . '/flarum')) {
                            $configFile = $candidate;
                            break;
                        }
                    }
                    if (file_exists($configFile)) {
                        $config = require $configFile;
                        $dbConfig = $config['database'] ?? [];

                        $host = $dbConfig['host'] ?? 'localhost';
                        $port = $dbConfig['port'] ?? 3306;
                        $dbname = $dbConfig['database'] ?? '';
                        $user = $dbConfig['username'] ?? 'root';
                        $pass = $dbConfig['password'] ?? '';
                        $charset = $dbConfig['charset'] ?? 'utf8mb4';
                        $prefix = $dbConfig['prefix'] ?? '';

                        $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=$charset";
                        $pdo = new \PDO($dsn, $user, $pass, [
                            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_SILENT,
                            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
                        ]);

                        $stmt = $pdo->prepare("SELECT `key`, `value` FROM `{$prefix}settings` WHERE `key` LIKE 'framio.module.%'");
                        if ($stmt && $stmt->execute()) {
                            while ($row = $stmt->fetch()) {
                                self::$settings[$row['key']] = $row['value'];
                            }
                        }
                    }
                } catch (\Throwable $e) {
                    // Hata durumunda varsayılan olarak açık tut
                }
            }

            $fullKey = "framio.module.{$key}.enabled";
            if (array_key_exists($fullKey, self::$settings)) {
                $val = self::$settings[$fullKey];
                return $val === '1' || $val === 1 || $val === true;
            }

            return true; // Varsayılan: Etkin
        }

        /**
         * Modül etkinse extender dizisini döner, pasifse boş dizi döner.
         */
        public static function conditional(string $key, array $extenders): array
        {
            return self::isEnabled($key) ? $extenders : [];
        }

        /** Pasif modül anahtarları (ör. ['user-directory']) */
        public static function disabled(): array
        {
            self::isEnabled('__load__');
            $out = [];
            foreach (self::$settings as $k => $v) {
                if (preg_match('/^framio\.module\.(.+)\.enabled$/', $k, $m) && !($v === '1' || $v === 1 || $v === true)) {
                    $out[] = $m[1];
                }
            }

            return $out;
        }

        /**
         * Pasif modül listesini foruma gönderir; paketlerin tarayıcı kodu
         * bu listeye bakarak pasif modülün arayüzünü hiç çalıştırmaz.
         * Her paket ekler; aynı alan tanımı tekrar eklense de sonuç aynıdır.
         */
        public static function clientState(): array
        {
            return [
                (new \Flarum\Extend\ApiResource(\Flarum\Api\Resource\ForumResource::class))
                    ->fields(fn () => [
                        \Flarum\Api\Schema\Arr::make('framioDisabledModules')->get(fn () => self::disabled()),
                    ]),
            ];
        }
    }
}
