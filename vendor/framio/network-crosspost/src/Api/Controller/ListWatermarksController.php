<?php

namespace Framio\NetworkCrosspost\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class ListWatermarksController implements RequestHandlerInterface
{
    public function __construct(
        protected SettingsRepositoryInterface $settings
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        // Secret key doğrulama (dış sitelerden gelen istekler için)
        $body = $request->getQueryParams();
        $secret = $body['secret'] ?? '';
        $targetUser = trim($body['username'] ?? '');
        $localSecret = (string) $this->settings->get('framio-network-crosspost.secret_key', '');

        // Eğer secret verilmişse doğrula, verilmemişse oturum açmış kullanıcı kontrolü yap
        if (!empty($secret)) {
            if (!hash_equals($localSecret, $secret)) {
                return new JsonResponse(['error' => 'Unauthorized'], 401);
            }
        } else {
            $actor = RequestUtil::getActor($request);
            if ($actor->isGuest()) {
                return new JsonResponse(['error' => 'Unauthorized'], 401);
            }
            if (empty($targetUser)) {
                $targetUser = $actor->username;
            }
        }

        $watermarks = [];
        $wmBaseDir = public_path('assets/watermarks');

        if (!is_dir($wmBaseDir)) {
            return new JsonResponse(['watermarks' => [], 'user' => $targetUser]);
        }

        // Upload & EXIF'in imza yapısı (dağıtım modu, site şablonları, kişisel imzalar) varsa
        // yükleme ekranıyla aynı seçenekler döndürülür
        if ($structured = $this->uploadExifWatermarks($wmBaseDir, $targetUser)) {
            return new JsonResponse($structured);
        }

        // Temiz username (güvenlik)
        $cleanTargetUser = preg_replace('/[^a-zA-Z0-9_-]/', '', $targetUser);

        // 1. ÖNCELİK: İstenen kullanıcı adına ait özel klasör var mı? (Ulaşım Arşiv tarzı)
        $userDir = !empty($cleanTargetUser) ? $wmBaseDir . '/' . $cleanTargetUser : null;
        $matchedUser = null;
        $hasPersonal = false;

        if ($userDir && is_dir($userDir)) {
            $matchedUser = $cleanTargetUser;
            $hasPersonal = true;
            $watermarks = $this->scanDirectoryWatermarks($userDir, $cleanTargetUser);
        }

        // 2. Eğer kullanıcıya özel klasör yoksa veya içi boşsa, 'ulasimarsiv' varsayılan klasörüne bak
        if (empty($watermarks) && is_dir($wmBaseDir . '/ulasimarsiv')) {
            $matchedUser = 'ulasimarsiv';
            $watermarks = $this->scanDirectoryWatermarks($wmBaseDir . '/ulasimarsiv', 'ulasimarsiv');
        }

        // 3. Eğer klasörlü yapı yoksa (Spotters Turkey gibi doğrudan assets/watermarks/*.png dosyaları varsa)
        if (empty($watermarks)) {
            $matchedUser = 'global';
            $files = scandir($wmBaseDir);
            foreach ($files as $file) {
                if ($file === '.' || $file === '..') continue;
                $filePath = $wmBaseDir . '/' . $file;
                if (is_file($filePath) && strtolower(pathinfo($file, PATHINFO_EXTENSION)) === 'png') {
                    $name = pathinfo($file, PATHINFO_FILENAME);
                    $watermarks[] = [
                        'id' => $file,
                        'name' => $this->humanizeName($name),
                        'filename' => $file,
                        'folder' => null,
                        'type' => $this->detectOrientation($name),
                        'url' => '/assets/watermarks/' . $file,
                    ];
                }
            }
        }

        return new JsonResponse([
            'watermarks' => $watermarks,
            'owner_username' => $matchedUser,
            'has_personal_watermark' => $hasPersonal,
            'requested_username' => $targetUser
        ]);
    }

    private function uploadExifWatermarks(string $baseDir, string $username): ?array
    {
        $raw = $this->settings->get('framio-upload-exif.watermark_templates');
        $templates = $raw ? json_decode($raw, true) : null;
        if (!is_array($templates) || !$templates) {
            return null;
        }

        $mode = (string) $this->settings->get('framio-upload-exif.watermark_mode', 'hybrid');
        if (!in_array($mode, ['hybrid', 'templates', 'personal'], true)) {
            $mode = 'hybrid';
        }

        $list = [];

        // Kişisel imzalar (assets/watermarks/<kullanıcı>/)
        $cleanUser = preg_replace('/[^a-zA-Z0-9_.-]/', '', $username);
        $hasPersonal = false;
        if ($mode !== 'templates' && $cleanUser !== '' && is_dir($baseDir . '/' . $cleanUser)) {
            foreach (scandir($baseDir . '/' . $cleanUser) as $f) {
                if (!preg_match('/\.(png|webp)$/i', $f)) continue;
                $portrait = stripos($f, 'dikey') !== false;
                $hasPersonal = true;
                $list[] = [
                    'id' => $cleanUser . '/' . $f,
                    'name' => 'Kişisel İmza' . ($portrait ? ' (Dikey)' : ' (Yatay)'),
                    'label' => 'Kişisel İmza',
                    'filename' => $f,
                    'folder' => $cleanUser,
                    'type' => $portrait ? 'portrait' : 'landscape',
                    'is_personal' => true,
                    'url' => '/assets/watermarks/' . rawurlencode($cleanUser) . '/' . rawurlencode($f),
                ];
            }
        }

        // Site şablonları (admin'deki sıra, etiket ve renklerle)
        if ($mode !== 'personal') {
            usort($templates, fn ($a, $b) => (int) ($a['sort_order'] ?? 0) <=> (int) ($b['sort_order'] ?? 0));
            foreach ($templates as $t) {
                $file = (string) ($t['filename'] ?? $t['id'] ?? '');
                if ($file === '') continue;
                $rel = is_file($baseDir . '/global/' . $file) ? 'global/' . $file : $file;
                if (!is_file($baseDir . '/' . $rel)) continue;
                $label = (string) ($t['label'] ?? $this->humanizeName(pathinfo($file, PATHINFO_FILENAME)));
                $list[] = [
                    'id' => $rel,
                    'name' => $label,
                    'label' => $label,
                    'filename' => $file,
                    'folder' => null,
                    'type' => ($t['orientation'] ?? 'landscape') === 'portrait' ? 'portrait' : 'landscape',
                    'position' => $t['position'] ?? null,
                    'bg_color' => $t['bg_color'] ?? null,
                    'text_color' => $t['text_color'] ?? null,
                    'border_color' => $t['border_color'] ?? null,
                    'is_personal' => false,
                    'url' => '/assets/watermarks/' . implode('/', array_map('rawurlencode', explode('/', $rel))),
                ];
            }
        }

        return [
            'mode' => $mode,
            'watermarks' => $list,
            'owner_username' => $hasPersonal ? $cleanUser : 'global',
            'has_personal_watermark' => $hasPersonal,
            'requested_username' => $username,
        ];
    }

    private function scanDirectoryWatermarks(string $dir, string $folderName): array
    {
        $watermarks = [];
        $files = scandir($dir);
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') continue;
            if (strtolower(pathinfo($file, PATHINFO_EXTENSION)) !== 'png') continue;

            $name = pathinfo($file, PATHINFO_FILENAME);
            $watermarks[] = [
                'id' => $folderName . '/' . $file,
                'name' => $this->humanizeName($name),
                'filename' => $file,
                'folder' => $folderName,
                'type' => $this->detectOrientation($name),
                'url' => '/assets/watermarks/' . $folderName . '/' . $file,
            ];
        }
        return $watermarks;
    }

    private function detectOrientation(string $name): string
    {
        $lower = strtolower($name);
        if (str_contains($lower, 'dikey') || str_contains($lower, 'portrait') || str_contains($lower, 'vertical')) {
            return 'portrait';
        }
        if (str_contains($lower, 'yatay') || str_contains($lower, 'landscape') || str_contains($lower, 'horizontal')) {
            return 'landscape';
        }
        return 'other';
    }

    private function humanizeName(string $name): string
    {
        // ulasimarsiv_yatay_wm -> Ulasimarsiv Yatay
        $name = str_replace(['_wm', '_'], ['', ' '], $name);
        return ucwords(trim($name));
    }
}
