<?php

namespace Framio\PackageManager\Services;

class PackagistClient
{
    private string $userAgent = 'Framio-Package-Manager/1.0 (dev.framiomedia.com)';

    /**
     * Packagist üzerinde Flarum uzantılarını arar.
     */
    public function search(string $query = '', int $page = 1, int $perPage = 15): array
    {
        $queryParam = urlencode($query);
        $url = "https://packagist.org/search.json?type=flarum-extension&page={$page}&per_page={$perPage}";
        if (!empty($query)) {
            $url .= "&q={$queryParam}";
        }

        $response = $this->fetchJson($url);
        if (!$response) {
            return ['results' => [], 'total' => 0];
        }

        return [
            'results' => $response['results'] ?? [],
            'total' => $response['total'] ?? 0,
            'next' => $response['next'] ?? null,
        ];
    }

    /**
     * Belirtilen eklentinin detaylarını ve en son sürüm indirme (dist) bilgilerini çeker.
     */
    public function getPackageDetails(string $packageName): ?array
    {
        $packageName = strtolower(trim($packageName));
        $url = "https://repo.packagist.org/p2/{$packageName}.json";

        $data = $this->fetchJson($url);
        if (!$data || empty($data['packages'][$packageName])) {
            return null;
        }

        $versions = $data['packages'][$packageName];
        // En güncel kararlı sürümü veya son sürümü bul
        $latest = null;
        foreach ($versions as $ver) {
            $versionStr = $ver['version'] ?? '';
            // dev-master olmayan ilk kararlı sürümü tercih et
            if (!str_starts_with($versionStr, 'dev-')) {
                $latest = $ver;
                break;
            }
        }

        if (!$latest && !empty($versions)) {
            $latest = $versions[0];
        }

        return $latest;
    }

    private function fetchJson(string $url): ?array
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERAGENT, $this->userAgent);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($status !== 200 || !$body) {
            return null;
        }

        return json_decode($body, true);
    }
}
