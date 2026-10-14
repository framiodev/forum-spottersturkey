<?php

namespace Framio\UploadExif\Api\Controller;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Flarum\Settings\SettingsRepositoryInterface;

class WatermarkManagementController implements RequestHandlerInterface
{
    const TEMPLATES_SETTING_KEY = 'framio-upload-exif.watermark_templates';
    const MODE_SETTING_KEY = 'framio-upload-exif.watermark_mode';
    const PERSONAL_UPLOAD_KEY = 'framio-upload-exif.allow_personal_upload';

    protected $settings;

    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $method = $request->getMethod();
        $params = $request->getQueryParams();

        $baseDir = public_path('assets/watermarks');
        if (!is_dir($baseDir)) {
            mkdir($baseDir, 0755, true);
        }
        $globalFolder = $baseDir . '/global';
        if (!is_dir($globalFolder)) {
            mkdir($globalFolder, 0755, true);
        }

        // ==========================================
        // 1. LİSTELEME (GET)
        // ==========================================
        if ($method === 'GET') {
            $mode = $this->settings->get(self::MODE_SETTING_KEY, 'hybrid');
            if (!in_array($mode, ['hybrid', 'templates', 'personal'])) {
                $mode = 'hybrid';
            }

            $templates = $this->getTemplates($baseDir);

            // Kişisel imzalar: yönetici 'for_user' ile başka bir üyenin imzalarını isteyebilir
            $wmUser = $actor->username;
            if ($actor->isAdmin() && !empty($params['for_user'])) {
                $wmUser = $this->sanitizeFilename((string) $params['for_user']);
            }
            $userFolder = $baseDir . '/' . $wmUser;
            $userWatermarks = [];
            if (!$actor->isGuest() && is_dir($userFolder)) {
                $files = scandir($userFolder);
                foreach ($files as $f) {
                    if ($f === '.' || $f === '..') continue;
                    if (preg_match('/\.(png|webp)$/i', $f)) {
                        $isPortrait = stripos($f, 'dikey') !== false;
                        $userWatermarks[] = [
                            'id' => $f,
                            'name' => $f,
                            'filename' => $f,
                            'label' => 'Kişisel İmza' . ($isPortrait ? ' (Dikey)' : ' (Yatay)'),
                            'orientation' => $isPortrait ? 'portrait' : 'landscape',
                            'type' => $isPortrait ? 'portrait' : 'landscape',
                            'position' => 'corner',
                            'style' => 'personal',
                            'icon' => 'fas fa-signature',
                            'url' => '/assets/watermarks/' . rawurlencode($wmUser) . '/' . rawurlencode($f),
                            'is_personal' => true,
                            'sort_order' => 0,
                        ];
                    }
                }
            }

            // Dağıtım moduna göre modal için filtrelenmiş imza listesi
            $modalWatermarks = [];
            if ($mode === 'personal') {
                $modalWatermarks = $userWatermarks;
            } elseif ($mode === 'templates') {
                $modalWatermarks = $templates;
            } else { // hybrid (default)
                $modalWatermarks = array_merge($userWatermarks, $templates);
            }

            // Admin için tüm kullanıcıların imzaları listesi
            $allUsersWatermarks = [];
            if ($actor->isAdmin()) {
                $folders = scandir($baseDir);
                foreach ($folders as $folderName) {
                    if ($folderName === '.' || $folderName === '..' || $folderName === 'global') continue;
                    $fullPath = $baseDir . '/' . $folderName;
                    if (is_dir($fullPath)) {
                        $fItems = scandir($fullPath);
                        $wms = [];
                        foreach ($fItems as $f) {
                            if ($f === '.' || $f === '..') continue;
                            if (preg_match('/\.(png|webp)$/i', $f)) {
                                $wms[] = [
                                    'filename' => $f,
                                    'url' => '/assets/watermarks/' . rawurlencode($folderName) . '/' . rawurlencode($f)
                                ];
                            }
                        }
                        if (!empty($wms)) {
                            $allUsersWatermarks[] = [
                                'username' => $folderName,
                                'watermarks' => $wms
                            ];
                        }
                    }
                }
            }

            return new JsonResponse([
                'mode' => $mode,
                'allow_personal_upload' => $this->allowPersonalUpload(),
                'watermarks' => array_values($modalWatermarks),
                'templates' => array_values($templates),
                'user' => array_values($userWatermarks),
                'global' => array_values($templates), // Admin panel uyumluluğu
                'admin_users' => $allUsersWatermarks,
            ]);
        }

        // ==========================================
        // 2. YÜKLEME VE ŞABLON YÖNETİMİ (POST)
        // ==========================================
        if ($method === 'POST') {
            $body = $request->getParsedBody();
            $action = $body['action'] ?? 'upload';

            // Şablon özelliklerini güncelleme (Admin)
            if ($action === 'save_template') {
                $actor->assertAdmin();
                $id = $body['id'] ?? null;
                if (!$id) return new JsonResponse(['error' => 'Şablon ID eksik.'], 400);

                $templates = $this->getTemplates($baseDir);
                $found = false;
                foreach ($templates as &$t) {
                    if ($t['id'] === $id || $t['filename'] === $id) {
                        if (isset($body['label'])) $t['label'] = trim($body['label']);
                        if (isset($body['orientation']) && in_array($body['orientation'], ['landscape', 'portrait', 'square', 'all'])) {
                            $t['orientation'] = $body['orientation'];
                            $t['type'] = $body['orientation'];
                        }
                        if (isset($body['position']) && in_array($body['position'], ['corner', 'center'])) {
                            $t['position'] = $body['position'];
                        }
                        if (isset($body['style']) && in_array($body['style'], ['white', 'black', 'color'])) {
                            $t['style'] = $body['style'];
                        }
                        if (isset($body['sort_order'])) {
                            $t['sort_order'] = (int)$body['sort_order'];
                        }
                        // Seçildiğinde buton renkleri (boş = varsayılan tema)
                        foreach (['bg_color', 'text_color', 'border_color'] as $ck) {
                            if (array_key_exists($ck, $body)) {
                                $t[$ck] = $this->sanitizeColor($body[$ck]);
                            }
                        }
                        $found = true;
                        break;
                    }
                }
                if ($found) {
                    // Sıralamaya göre diz
                    usort($templates, fn($a, $b) => ($a['sort_order'] ?? 0) <=> ($b['sort_order'] ?? 0));
                    $this->saveTemplates($templates);
                    return new JsonResponse(['success' => true, 'templates' => $templates]);
                }
                return new JsonResponse(['error' => 'Şablon bulunamadı.'], 404);
            }

            // Şablon sırası (Admin): ids dizisindeki sıraya göre
            if ($action === 'reorder_templates') {
                $actor->assertAdmin();
                $ids = $body['ids'] ?? [];
                if (!is_array($ids)) return new JsonResponse(['error' => 'Geçersiz veri.'], 400);
                $pos = array_flip(array_values(array_map('strval', $ids)));
                $templates = $this->getTemplates($baseDir);
                foreach ($templates as &$t) {
                    $key = (string)($t['id'] ?? $t['filename']);
                    $t['sort_order'] = $pos[$key] ?? (count($pos) + (int)($t['sort_order'] ?? 0));
                }
                unset($t);
                usort($templates, fn($a, $b) => ($a['sort_order'] ?? 0) <=> ($b['sort_order'] ?? 0));
                $this->saveTemplates($templates);
                return new JsonResponse(['success' => true, 'templates' => $templates]);
            }

            // Toplu şablon kaydı / yeniden sıralama (Admin)
            if ($action === 'save_all_templates') {
                $actor->assertAdmin();
                $incomingTemplates = $body['templates'] ?? [];
                if (is_array($incomingTemplates)) {
                    $this->saveTemplates($incomingTemplates);
                    return new JsonResponse(['success' => true, 'templates' => $incomingTemplates]);
                }
                return new JsonResponse(['error' => 'Geçersiz veri.'], 400);
            }

            // Dosya Yükleme
            $actor->assertRegistered();
            $uploadedFiles = $request->getUploadedFiles();
            $file = $uploadedFiles['watermark'] ?? null;
            $isGlobal = ($body['is_global'] ?? '0') === '1' && $actor->isAdmin();

            // Admin başka bir kullanıcı için yüklüyor olabilir
            $targetUser = $actor->username;
            if ($actor->isAdmin() && !empty($body['target_username'])) {
                $targetUser = $this->sanitizeFilename($body['target_username']);
            }

            // Üyelerin kendi kişisel imzasını yüklemesi admin ayarına bağlı
            if (!$isGlobal && $targetUser === $actor->username && !$actor->isAdmin() && !$this->allowPersonalUpload()) {
                return new JsonResponse(['error' => 'Kişisel imza yükleme kapalı.'], 403);
            }

            if (!$file || $file->getError() !== UPLOAD_ERR_OK) {
                return new JsonResponse(['error' => 'Dosya yüklenemedi.'], 400);
            }

            $clientFilename = $file->getClientFilename();
            $ext = strtolower(pathinfo($clientFilename, PATHINFO_EXTENSION));
            if (!in_array($ext, ['png', 'webp'])) {
                return new JsonResponse(['error' => 'Sadece şeffaf PNG veya WebP filigran formatı desteklenir.'], 400);
            }

            $rawBaseName = pathinfo($clientFilename, PATHINFO_FILENAME);
            $safeName = time() . '_' . $this->sanitizeFilename($rawBaseName) . '.' . $ext;

            if ($isGlobal) {
                // Önce mevcut şablonları al (böylece auto-discovery henüz taşınmamış dosyayı çift görmez)
                $templates = $this->getTemplates($baseDir);

                $targetPath = $globalFolder . '/' . $safeName;
                $file->moveTo($targetPath);

                $label = !empty($body['label']) ? trim($body['label']) : $this->autoDetermineLabel($rawBaseName);
                $orientation = in_array($body['orientation'] ?? '', ['landscape', 'portrait', 'square', 'all']) ? $body['orientation'] : (stripos($rawBaseName, 'dikey') !== false ? 'portrait' : 'landscape');
                $position = in_array($body['position'] ?? '', ['corner', 'center']) ? $body['position'] : (stripos($rawBaseName, 'orta') !== false ? 'center' : 'corner');
                $style = in_array($body['style'] ?? '', ['white', 'black', 'color']) ? $body['style'] : (stripos($rawBaseName, 'siyah') !== false ? 'black' : (stripos($rawBaseName, 'renkli') !== false ? 'color' : 'white'));

                $relativeUrl = '/assets/watermarks/global/' . $safeName;
                $newTemplate = [
                    'id' => $safeName,
                    'filename' => $safeName,
                    'name' => $safeName,
                    'label' => $label,
                    'orientation' => $orientation,
                    'type' => $orientation,
                    'position' => $position,
                    'style' => $style,
                    'url' => $relativeUrl,
                    'sort_order' => count($templates),
                    'is_personal' => false,
                ];

                // Var olan şablonlarda bu dosya varsa güncelle, yoksa ekle (ASLA ÇİFTLEME YAPMAZ)
                $found = false;
                foreach ($templates as &$t) {
                    if (($t['filename'] ?? '') === $safeName || ($t['id'] ?? '') === $safeName) {
                        $t = $newTemplate;
                        $found = true;
                        break;
                    }
                }
                unset($t);

                if (!$found) {
                    $templates[] = $newTemplate;
                }

                $this->saveTemplates($templates);

                return new JsonResponse([
                    'success' => true,
                    'template' => $newTemplate,
                    'templates' => $templates,
                    'filename' => $safeName,
                    'url' => $relativeUrl,
                ]);
            } else {
                $targetDir = $baseDir . '/' . $targetUser;
                if (!is_dir($targetDir)) mkdir($targetDir, 0755, true);
                $targetPath = $targetDir . '/' . $safeName;
                $file->moveTo($targetPath);

                $relativeUrl = '/assets/watermarks/' . rawurlencode($targetUser) . '/' . $safeName;

                return new JsonResponse([
                    'success' => true,
                    'filename' => $safeName,
                    'url' => $relativeUrl,
                ]);
            }
        }

        // ==========================================
        // 3. SİLME (DELETE)
        // ==========================================
        if ($method === 'DELETE') {
            $body = $request->getParsedBody();
            $filename = basename($body['filename'] ?? '');
            $id = $body['id'] ?? $filename;
            $isGlobal = ($body['is_global'] ?? '0') === '1';

            if ($isGlobal) {
                $actor->assertAdmin();
                // Dosyayı diskten sil
                $targetFile = $globalFolder . '/' . $filename;
                if (!file_exists($targetFile)) {
                    $targetFile = $baseDir . '/' . $filename;
                }
                if (file_exists($targetFile)) {
                    @unlink($targetFile);
                }

                // Şablon listesinden çıkar
                $templates = $this->getTemplates($baseDir);
                $templates = array_filter($templates, function ($t) use ($id, $filename) {
                    return ($t['id'] ?? '') !== $id && ($t['filename'] ?? '') !== $filename;
                });
                $templates = array_values($templates);
                $this->saveTemplates($templates);

                return new JsonResponse(['success' => true, 'templates' => $templates]);
            } else {
                if ($actor->isAdmin() && !empty($body['target_username'])) {
                    $targetUser = $this->sanitizeFilename($body['target_username']);
                    $targetFile = $baseDir . '/' . $targetUser . '/' . $filename;
                } else {
                    $actor->assertRegistered();
                    $targetFile = $baseDir . '/' . $actor->username . '/' . $filename;
                }

                if (file_exists($targetFile)) {
                    @unlink($targetFile);
                }

                return new JsonResponse(['success' => true]);
            }
        }

        return new JsonResponse(['error' => 'Geçersiz istek.'], 405);
    }

    /**
     * Kayıtlı şablonları getirir. Ayarlarda henüz kayıt yoksa diskteki mevcut filigranları otomatik ekler.
     */
    protected function getTemplates(string $baseDir): array
    {
        $raw = $this->settings->get(self::TEMPLATES_SETTING_KEY);
        $templates = [];

        if (!empty($raw)) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $templates = $decoded;
            }
        }

        // Eğer henüz şablon kaydı yoksa, mevcut dosyaları tara ve otomatik başlat
        if (empty($templates)) {
            $templates = $this->autoDiscoverTemplates($baseDir);
            if (!empty($templates)) {
                $this->saveTemplates($templates);
            }
        }

        // Şablon alanlarının eksiksiz olmasını ve tekilleştirmeyi sağla
        $unique = [];
        foreach ($templates as $i => &$t) {
            $t['id'] = $t['id'] ?? ($t['filename'] ?? 'wm_' . $i);
            $t['name'] = $t['name'] ?? $t['id'];
            $t['filename'] = $t['filename'] ?? $t['id'];
            $t['orientation'] = $t['orientation'] ?? 'landscape';
            $t['type'] = $t['orientation'];
            $t['position'] = $t['position'] ?? 'corner';
            $t['style'] = $t['style'] ?? 'white';
            $t['label'] = $t['label'] ?? $this->autoDetermineLabel($t['filename'] ?? $t['id']);
            $t['sort_order'] = (int)($t['sort_order'] ?? $i);
            $t['is_personal'] = false;
            if (empty($t['url'])) {
                if (file_exists($baseDir . '/global/' . ($t['filename'] ?? ''))) {
                    $t['url'] = '/assets/watermarks/global/' . rawurlencode($t['filename']);
                } else {
                    $t['url'] = '/assets/watermarks/' . rawurlencode($t['filename'] ?? '');
                }
            }
            $fn = $t['filename'];
            if (!isset($unique[$fn])) {
                $unique[$fn] = $t;
            }
        }
        unset($t);

        $templates = array_values($unique);
        usort($templates, fn($a, $b) => ($a['sort_order'] ?? 0) <=> ($b['sort_order'] ?? 0));

        return $templates;
    }

    protected function saveTemplates(array $templates): void
    {
        $this->settings->set(self::TEMPLATES_SETTING_KEY, json_encode(array_values($templates), JSON_UNESCAPED_UNICODE));
    }

    /**
     * assets/watermarks ve assets/watermarks/global dizinlerindeki mevcut filigranları tarar.
     */
    protected function autoDiscoverTemplates(string $baseDir): array
    {
        $discovered = [];
        $scannedFiles = [];

        // 1. assets/watermarks/global dizini
        $globalDir = $baseDir . '/global';
        if (is_dir($globalDir)) {
            $files = scandir($globalDir);
            foreach ($files as $f) {
                if ($f === '.' || $f === '..') continue;
                if (preg_match('/\.(png|webp)$/i', $f)) {
                    $scannedFiles[$f] = [
                        'filename' => $f,
                        'url' => '/assets/watermarks/global/' . rawurlencode($f),
                        'in_global' => true,
                    ];
                }
            }
        }

        // 2. assets/watermarks kök dizini (kullanıcı klasörleri hariç)
        if (is_dir($baseDir)) {
            $files = scandir($baseDir);
            foreach ($files as $f) {
                if ($f === '.' || $f === '..' || $f === 'global') continue;
                $fullPath = $baseDir . '/' . $f;
                if (!is_dir($fullPath) && preg_match('/\.(png|webp)$/i', $f)) {
                    if (!isset($scannedFiles[$f])) {
                        $scannedFiles[$f] = [
                            'filename' => $f,
                            'url' => '/assets/watermarks/' . rawurlencode($f),
                            'in_global' => false,
                        ];
                    }
                }
            }
        }

        $order = 0;
        foreach ($scannedFiles as $f => $info) {
            $n = strtolower($f);
            $orientation = stripos($n, 'dikey') !== false ? 'portrait' : 'landscape';
            $position = stripos($n, 'orta') !== false ? 'center' : 'corner';
            
            $style = 'white';
            if (stripos($n, 'siyah') !== false) {
                $style = 'black';
            } elseif (stripos($n, 'renkli') !== false || stripos($n, 'color') !== false) {
                $style = 'color';
            }

            $label = $this->autoDetermineLabel($f);

            $discovered[] = [
                'id' => $f,
                'filename' => $f,
                'name' => $f,
                'label' => $label,
                'orientation' => $orientation,
                'type' => $orientation,
                'position' => $position,
                'style' => $style,
                'url' => $info['url'],
                'sort_order' => $order++,
                'is_personal' => false,
            ];
        }

        return $discovered;
    }

    protected function autoDetermineLabel(string $filename): string
    {
        $n = strtolower($filename);
        $color = 'Beyaz';
        if (stripos($n, 'siyah') !== false) $color = 'Siyah';
        elseif (stripos($n, 'renkli') !== false || stripos($n, 'color') !== false) $color = 'Renkli';

        $pos = '';
        if (stripos($n, 'orta') !== false) $pos = ' (Orta)';
        elseif (stripos($n, 'kose') !== false || stripos($n, 'ke') !== false) $pos = ' (Köşe)';

        $dir = stripos($n, 'dikey') !== false ? ' Dikey' : '';

        return "{$color}{$dir} İmza{$pos}";
    }

    protected function sanitizeFilename(string $string): string
    {
        $turkish = ['ı', 'ğ', 'ü', 'ş', 'ö', 'ç', 'İ', 'Ğ', 'Ü', 'Ş', 'Ö', 'Ç'];
        $english = ['i', 'g', 'u', 's', 'o', 'c', 'I', 'G', 'U', 'S', 'O', 'C'];
        $clean = str_replace($turkish, $english, $string);
        $clean = preg_replace('/[^A-Za-z0-9_-]/', '_', $clean);
        return trim(preg_replace('/_+/', '_', $clean), '_');
    }

    protected function allowPersonalUpload(): bool
    {
        return (bool) (int) $this->settings->get(self::PERSONAL_UPLOAD_KEY, '1');
    }

    /** #rgb / #rrggbb dışındaki değerleri reddeder; boş değer varsayılana döner. */
    protected function sanitizeColor($value): ?string
    {
        $value = trim((string) $value);
        return preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $value) ? strtolower($value) : null;
    }
}
