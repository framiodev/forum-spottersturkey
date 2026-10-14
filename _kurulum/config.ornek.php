<?php return array (
  // Canlıdaki mevcut config.php'yi SİLMEYİN; yalnızca aşağıdaki farkları ona uygulayın.
  'debug' => false,
  'database' =>
  array (
    'driver' => 'mysql',            // canlıdaki değer kalabilir (mysql / mariadb)
    'host' => 'localhost',
    'port' => 3306,
    'database' => 'CANLI_VERITABANI_ADI',
    'username' => 'CANLI_KULLANICI',
    'password' => 'CANLI_SIFRE',
    'charset' => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'prefix' => 'flhg_',
    'strict' => false,
    'engine' => 'InnoDB',
    'prefix_indexes' => true,
  ),
  'url' => 'https://forum.spottersturkey.com',
  // 2.0 ile eklendi: işler veritabanı kuyruğunda bekler, cron ile işlenir (KURULUM.md adım 8)
  'queue' =>
  array (
    'driver' => 'database',
  ),
  'paths' =>
  array (
    'api' => 'api',
    'admin' => 'admin',
  ),
  'headers' =>
  array (
    'poweredByHeader' => true,
    'referrerPolicy' => 'same-origin',
  ),
);
