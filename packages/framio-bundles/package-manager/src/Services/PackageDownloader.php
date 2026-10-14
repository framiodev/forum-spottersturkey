<?php

namespace Framio\PackageManager\Services;

class PackageDownloader
{
    private string $userAgent = 'Framio-Package-Manager/1.0';

    /**
     * URL'den geçici bir ZIP dosyası indirir ve geçici dosya yolunu döner.
     */
    public function downloadZip(string $url): ?string
    {
        $tempFile = tempnam(sys_get_temp_dir(), 'framio_pkg_') . '.zip';
        $fp = fopen($tempFile, 'w+');
        if (!$fp) {
            return null;
        }

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_FILE, $fp);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_USERAGENT, $this->userAgent);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $success = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        fclose($fp);

        if (!$success || $statusCode < 200 || $statusCode >= 300) {
            @unlink($tempFile);
            return null;
        }

        return $tempFile;
    }

    /**
     * ZIP dosyasını hedef klasöre ayıklar.
     * Eğer zip içinde tek bir kök klasör varsa, içeriklerini doğrudan hedef klasöre çıkarır.
     */
    public function extractZip(string $zipFilePath, string $targetDir): bool
    {
        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0755, true);
        }

        $tempExtract = sys_get_temp_dir() . '/framio_extract_' . uniqid();
        mkdir($tempExtract, 0755, true);

        $zip = new \ZipArchive();
        if ($zip->open($zipFilePath) !== true) {
            return false;
        }

        $zip->extractTo($tempExtract);
        $zip->close();

        // ZIP içeriğini incele
        $entries = array_diff(scandir($tempExtract), ['.', '..']);
        $sourceDir = $tempExtract;

        // Tek bir üst klasör varsa (GitHub zip formatları gibi: repo-main/)
        if (count($entries) === 1) {
            $first = reset($entries);
            $subPath = $tempExtract . '/' . $first;
            if (is_dir($subPath)) {
                $sourceDir = $subPath;
            }
        }

        // Kaynak klasördeki tüm dosyaları hedef klasöre kopyala
        $this->copyDirectory($sourceDir, $targetDir);

        // Geçici klasörü temizle
        $this->deleteDirectory($tempExtract);

        return true;
    }

    public function copyDirectory(string $src, string $dst): void
    {
        if (!is_dir($dst)) {
            mkdir($dst, 0755, true);
        }

        $dir = opendir($src);
        while (($file = readdir($dir)) !== false) {
            if ($file === '.' || $file === '..') {
                continue;
            }
            $srcPath = $src . '/' . $file;
            $dstPath = $dst . '/' . $file;
            if (is_dir($srcPath)) {
                $this->copyDirectory($srcPath, $dstPath);
            } else {
                copy($srcPath, $dstPath);
            }
        }
        closedir($dir);
    }

    public function deleteDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = "$dir/$file";
            is_dir($path) ? $this->deleteDirectory($path) : @unlink($path);
        }
        @rmdir($dir);
    }
}
