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
