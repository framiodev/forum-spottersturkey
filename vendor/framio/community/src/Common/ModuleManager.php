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
                // packages/<group>/.. => packages/.. => root/config.php
                $configFile = dirname(__DIR__, 4) . '/config.php';
                if (!file_exists($configFile)) {
                    $configFile = dirname(__DIR__, 2) . '/config.php';
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
}
}
