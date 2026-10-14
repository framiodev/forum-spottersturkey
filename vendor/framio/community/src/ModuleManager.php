<?php

namespace Framio\Core;

class ModuleManager
{
    private static ?array $settings = null;

    /**
     * Veritabanından doğrudan modül durumunu kontrol eder.
     * Flarum henüz boot edilmeden önce Extend aşamasında çalışabilir.
     */
    public static function isEnabled(string $key): bool
    {
        if (self::$settings === null) {
            self::$settings = [];
            try {
                $configFile = dirname(__DIR__, 2) . '/config.php';
                if (file_exists($configFile)) {
                    $config = require $configFile;
                    $dbConfig = $config['database'] ?? [];

                    $driver = $dbConfig['driver'] ?? 'mariadb';
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
                // Hata durumunda (kurulum aşaması vb.) modülleri varsayılan olarak etkin kabul et
            }
        }

        $fullKey = "framio.module.{$key}.enabled";
        if (array_key_exists($fullKey, self::$settings)) {
            return self::$settings[$fullKey] === '1' || self::$settings[$fullKey] === 1 || self::$settings[$fullKey] === true;
        }

        return true; // Varsayılan olarak etkin
    }

    /**
     * Modül etkinse extend tanımını döndürür, değilse boş dizi döner.
     */
    public static function conditional(string $key, array $extenders): array
    {
        return self::isEnabled($key) ? $extenders : [];
    }
}
