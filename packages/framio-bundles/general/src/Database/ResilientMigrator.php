<?php

namespace Framio\General\Database;

use Flarum\Database\Migrator;
use Flarum\Extension\Extension;
use Illuminate\Database\QueryException;

/**
 * Birleşik paketlere (framio-*) geçişte, eski bağımsız eklentilerin (FoF vb.) göç kayıtları
 * farklı eklenti adıyla kalır. Aynı göç yeni adla yeniden çalışınca şema zaten o haldedir ve
 * "tablo/sütun/dizin zaten var" hatası migrate'i durdurur.
 *
 * Bu çalıştırıcı yalnızca bu "zaten uygulanmış" hatalarında göçü uygulanmış olarak kaydeder
 * ve devam eder; diğer tüm hatalar olduğu gibi fırlatılır.
 */
class ResilientMigrator extends Migrator
{
    /** MySQL/MariaDB: tablo var, sütun var, dizin adı var, silinecek alan yok, kısıtlama adı var, anahtar tekrarı */
    public const ALREADY_APPLIED = [1050, 1060, 1061, 1091, 1826, 1022];

    /** @var array<int, array{file: string, extension: ?string, code: int}> */
    public array $skipped = [];

    protected function runUp(string $path, string $file, ?Extension $extension = null): void
    {
        try {
            parent::runUp($path, $file, $extension);
        } catch (QueryException $e) {
            $code = (int) ($e->errorInfo[1] ?? 0);
            if (!in_array($code, self::ALREADY_APPLIED, true)) {
                throw $e;
            }

            $this->repository->log($file, $extension?->getId());
            $this->skipped[] = ['file' => $file, 'extension' => $extension?->getId(), 'code' => $code];
            $this->note("<comment>Zaten uygulanmış, kaydedildi:</comment> $file <fg=gray>(MySQL $code)</>");
        }
    }
}
