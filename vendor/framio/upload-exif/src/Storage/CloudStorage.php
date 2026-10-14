<?php

namespace Framio\UploadExif\Storage;

use Flarum\Foundation\Paths;
use Flarum\Settings\SettingsRepositoryInterface;
use Google\Cloud\Storage\Bucket;
use Google\Cloud\Storage\StorageClient;

/**
 * Firebase / Google Cloud Storage erişimi için tek nokta.
 * Kimlik: admin panelindeki JSON → yoksa storage/ altındaki kimlik dosyası (varsayılan firebase-auth.json).
 * Klasör ve alan adı admin panelinden ayarlanır.
 */
class CloudStorage
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected Paths $paths
    ) {
    }

    public function bucketName(): string
    {
        return trim((string) $this->settings->get('framio-upload-exif.firebase_bucket'));
    }

    public function customDomain(): string
    {
        return rtrim(trim((string) $this->settings->get('framio-upload-exif.custom_domain')), '/');
    }

    /** Buluttaki ana klasör (örn. assets/uploads), sonunda / olmadan */
    public function folder(): string
    {
        $folder = trim((string) $this->settings->get('framio-upload-exif.cloud_folder'), "/ \t");

        return $folder !== '' ? $folder : 'assets/uploads';
    }

    public function baseUrl(): string
    {
        return $this->customDomain() ?: 'https://storage.googleapis.com/' . $this->bucketName();
    }

    /** storage/ altındaki kimlik dosyasının tam yolu (yalnızca dosya adı kabul edilir) */
    public function keyFilePath(): ?string
    {
        $name = basename(trim((string) $this->settings->get('framio-upload-exif.firebase_key_file')) ?: 'firebase-auth.json');
        $path = $this->paths->storage . DIRECTORY_SEPARATOR . $name;

        return is_file($path) ? $path : null;
    }

    /** Kimlik kaynağı: 'settings' | 'file' | null */
    public function credentialSource(): ?string
    {
        $json = json_decode((string) $this->settings->get('framio-upload-exif.firebase_service_account'), true);
        if (is_array($json) && !empty($json['private_key'])) return 'settings';

        return $this->keyFilePath() ? 'file' : null;
    }

    public function isConfigured(): bool
    {
        return $this->bucketName() !== '' && $this->credentialSource() !== null;
    }

    public function bucket(): Bucket
    {
        if ($this->bucketName() === '') {
            throw new \RuntimeException('Firebase Storage Bucket adı yapılandırılmamış. Lütfen Admin panelinden giriniz.');
        }

        $config = [];
        $json = json_decode((string) $this->settings->get('framio-upload-exif.firebase_service_account'), true);
        if (is_array($json) && !empty($json['private_key'])) {
            $config['keyFile'] = $json;
        } elseif ($file = $this->keyFilePath()) {
            $config['keyFilePath'] = $file;
        }

        return (new StorageClient($config))->bucket($this->bucketName());
    }

    /** Görsel adresinden buluttaki nesne adını çıkarır (özel alan adı, storage.googleapis.com ve %20 kodlaması desteklenir) */
    public function objectName(string $url): ?string
    {
        $url = preg_replace('/\?.*$/', '', $url);
        $domain = $this->customDomain();

        if ($domain !== '' && str_starts_with($url, $domain . '/')) {
            $name = substr($url, strlen($domain) + 1);
        } else {
            $path = ltrim((string) parse_url($url, PHP_URL_PATH), '/');
            $host = (string) parse_url($url, PHP_URL_HOST);
            $prefix = $this->bucketName() . '/';
            if ($host === 'storage.googleapis.com' && str_starts_with($path, $prefix)) {
                $path = substr($path, strlen($prefix));
            }
            $name = $path;
        }

        $name = rawurldecode($name);

        return $name !== '' ? $name : null;
    }
}
