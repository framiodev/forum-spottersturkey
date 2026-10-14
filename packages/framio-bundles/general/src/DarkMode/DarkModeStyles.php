<?php

namespace Framio\General\DarkMode;

use Flarum\Frontend\Document;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Karanlık Mod modülü: Flarum'un karanlık temasında okunmayan / karanlığa geçmeyen
 * alanları düzeltir. Yalnızca [data-theme^=dark] altında çalışır; açık tema etkilenmez.
 *
 *  1. Vurgu rengi: çekirdek ana rengi (--primary-color / --link-color) karanlıkta değiştirmez.
 *     Koyu ana renkli sitelerde bağlantılar, aktif sekmeler ve vurgulu yazılar kaybolur.
 *     Ana renk butonları derleme anında sabitlendiği için değişkeni değiştirmek onları bozmaz.
 *  2. Palet (isteğe bağlı): zemin / yüzey / metin / soluk metin.
 *  3. Uyumluluk katmanı: eklentilerin satır içi yazdığı açık zeminleri, koyu yazıları ve açık
 *     kenarlıkları tema değişkenlerine çevirir (stil özniteliği seçicileriyle).
 *  4. Karanlık moda özel CSS.
 */
class DarkModeStyles
{
    /** Flarum'un varsayılan karanlık zemini (hsl(0,0%,10%)) */
    public const DEFAULT_DARK_BG = '#1a1a1a';

    /** Yama kuralları değişince artırılır; eski önbellek dosyası yeniden üretilir */
    private const PATCH_VERSION = '3';

    /** Yamanın kaynağı olan derlenmiş CSS (admin için alt sınıf değiştirir) */
    protected string $assetName = 'forum.css';

    /** Nötr açık zeminler → yüzey rengi */
    private const NEUTRAL_BG = [
        '#cccccc', '#dcdfe6', '#dddddd', '#dfe6e9', '#e0e0e0', '#e2e8f0', '#e5e5e5', '#e5e7eb', '#e8f5e9',
        '#e9ecef', '#eafaf1', '#ebf5fb', '#ecf0f1', '#ecfdf5', '#ededed', '#eeeeee', '#eef2ff', '#eef5fa',
        '#eff6ff', '#f0f0f0', '#f0f2f5', '#f0f3f5', '#f0f3f6', '#f0f7ff', '#f0fdf4', '#f1f1f1', '#f1f5f9',
        '#f3f4f6', '#f4f4f4', '#f4f6f8', '#f5f3ff', '#f5f5f5', '#f5f6fa', '#f5f8fc', '#f7f7f7', '#f8f9fa',
        '#f8fafc', '#f9f9f9', '#f9fafb', '#f9fbfd', '#faf5ff', '#fafafa', '#fcebf1', '#fcfcfc', '#fcfdfd',
        '#fdeeea', '#fdf2f8', '#fdf4ff', '#fdfdfd', '#fef2f2', '#fff4f4', '#fff5f5', '#fffbf2', '#ffffff',
    ];

    /** Renkli açık zeminler → tonu korunarak karartılır */
    private const TINTED_BG = [
        '#bae6fd', '#ccfbf1', '#dbeafe', '#dcfce7', '#e0e7ff', '#e0f2fe', '#e1f5fe', '#e3f2fd', '#e6f7ff',
        '#e7f0fd', '#e8f5e9', '#ecfdf5', '#eff6ff', '#f0fdf4', '#f3e8ff', '#f8d7da', '#fae8ff', '#faf5ff',
        '#fce7f3', '#fdf2f8', '#fee2e2', '#fef2f2', '#fef3c7', '#fef5e7', '#ffebee', '#fff3cd', '#fff4f4',
        '#fff8e1', '#fffbeb', '#fffbf2',
    ];

    /** Koyu nötr yazılar → metin rengi */
    private const DARK_TEXT = [
        '#000000', '#0f172a', '#111111', '#111827', '#1a202c', '#1e1b4b', '#1e293b', '#1f2937', '#202124',
        '#212121', '#222222', '#262626', '#2c3e50', '#2d3436', '#333333', '#334155', '#374151', '#3a3a3a',
        '#444444', '#475569', '#4a044e', '#4b5563', '#555555',
    ];

    /** Orta griler → soluk metin rengi */
    private const MID_TEXT = [
        '#2c3e50', '#2d3436', '#2f3640', '#333333', '#334155', '#374151', '#37474f', '#444444', '#455a64',
        '#475569', '#495057', '#4a5568', '#4b5563', '#4d5156', '#555555', '#595959', '#5c6b77', '#636e72',
        '#64748b', '#65676b', '#666666', '#6b7280', '#777777', '#7f8c8d', '#7f8fa6', '#868e96', '#888888',
        '#88929d', '#8e8e8e', '#8e9297', '#94a3b8', '#95a5a6', '#999999',
    ];

    /** Açık zeminler üzerinde kullanılan koyu renkli yazılar → açılarak okunur yapılır */
    private const DEEP_COLORED_TEXT = [
        '#005580', '#0077b5', '#0369a1', '#047857', '#065f46', '#075985', '#0b5c4e', '#0c4a6e', '#0d6efd',
        '#0f766e', '#1565c0', '#15803d', '#166534', '#1877f2', '#1976d2', '#1a0dab', '#1d4ed8', '#1e3a8a',
        '#1e40af', '#2563eb', '#2980b9', '#2a5298', '#2e7d32', '#3730a3', '#4267b2', '#4338ca', '#4d698e',
        '#4f46e5', '#5865f2', '#5b21b6', '#6366f1', '#6b21a8', '#6d28d9', '#701a75', '#721c24', '#7c3aed',
        '#7d2ae8', '#7e22ce', '#820300', '#856404', '#86198f', '#8b5cf6', '#8e44ad', '#92400e', '#991b1b',
        '#9b59b6', '#a21caf', '#b26a00', '#b45309', '#be185d', '#c026d3', '#c0392b', '#c62828', '#cf1322',
        '#db2777', '#dc2626', '#e11d48', '#e1306c',
    ];

    /** Açık kenarlıklar → koyu temaya uygun kenarlık */
    private const LIGHT_BORDER = [
        '#86efac', '#a7f3d0', '#bae6fd', '#bbf7d0', '#bfdbfe', '#c7d2fe', '#c8e6c9', '#cbd5e1', '#cccccc',
        '#d0e3f0', '#d1d5db', '#d9d9d9', '#dbdbdb', '#dbeafe', '#dcdde1', '#dcdfe6', '#dce4ec', '#ddd6fe',
        '#dddddd', '#dee2e6', '#e0e0e0', '#e0e4e8', '#e1e4e8', '#e2e8f0', '#e5e5e5', '#e5e7eb', '#e9ecef',
        '#eaeaea', '#eeeeee', '#eef2f7', '#f0f0f0', '#f0f2f5', '#f1f2f6', '#f1f3f5', '#f1f5f9', '#f3f3f3',
        '#f3f4f6', '#f5d0fe', '#f5f6f7', '#f8fafc', '#f9fafb', '#fadb14', '#fde68a', '#fecaca', '#fef3c7',
        '#ffeeba', '#ffffff',
    ];

    public function __construct(
        protected SettingsRepositoryInterface $settings
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        $css = $this->build();
        if ($css !== '') {
            $document->head[] = '<style id="framio-dark-mode">' . $css . '</style>';
        }

        // Uyumluluk katmanının ikinci yarısı: derlenmiş forum CSS'indeki sabit açık renkler
        if ($this->settings()['compat']) {
            $url = $this->patchedStylesheetUrl();
            if ($url) {
                $document->head[] = '<link rel="stylesheet" id="framio-dark-patch" href="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '">';
            }
        }
    }

    /**
     * forum.css değiştikçe (eklenti güncellemesi, önbellek temizliği) yeniden üretilen,
     * sürüm adlı karanlık yama dosyası. Hata olursa sessizce atlanır; site etkilenmez.
     */
    protected function patchedStylesheetUrl(): ?string
    {
        try {
            $disk = resolve(\Illuminate\Contracts\Filesystem\Factory::class)->disk('flarum-assets');
            if (!$disk->exists($this->assetName)) {
                return null;
            }

            $source = $disk->get($this->assetName);
            $name = 'framio-dark-' . pathinfo($this->assetName, PATHINFO_FILENAME) . '-' . substr(md5($source . self::PATCH_VERSION), 0, 10) . '.css';

            if (!$disk->exists($name)) {
                foreach ($disk->files() as $old) {
                    if (str_starts_with($old, 'framio-dark-' . pathinfo($this->assetName, PATHINFO_FILENAME) . '-') && $old !== $name) {
                        $disk->delete($old);
                    }
                }
                // Satır içi stiller için seçiciler + derlenmiş CSS'teki sabit renklerin karşılıkları
                $disk->put($name, $this->compatLayer('html[data-theme^=dark]') . "
" . (new CssDarkPatcher())->patch($source));
            }

            return $disk->url($name);
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function settings(): array
    {
        $get = fn (string $k, $d = '') => $this->settings->get('framio-general.dm_' . $k, $d);

        return [
            'accent_mode' => (string) ($get('accent_mode', 'auto') ?: 'auto'),
            'accent_custom' => ColorTools::normalizeHex($get('accent_custom')),
            'palette' => (bool) (int) $get('palette', '0'),
            'bg' => ColorTools::normalizeHex($get('bg')),
            'surface' => ColorTools::normalizeHex($get('surface')),
            'text' => ColorTools::normalizeHex($get('text')),
            'muted' => ColorTools::normalizeHex($get('muted')),
            'compat' => (bool) (int) $get('compat', '1'),
            'header_fix' => (bool) (int) $get('header_fix', '1'),
            'custom_css' => (string) $get('custom_css', ''),
        ];
    }

    /**
     * Seçilen moda göre karanlık vurgu rengi (ya da kapalıysa null).
     *
     * @return array{hex:?string,source:string,contrast:?float}
     */
    public function accent(?array $s = null): array
    {
        $s ??= $this->settings();
        $bg = ($s['palette'] && $s['bg']) ? $s['bg'] : self::DEFAULT_DARK_BG;
        $primary = ColorTools::normalizeHex($this->settings->get('theme_primary_color')) ?? '#4d698e';
        $secondary = ColorTools::normalizeHex($this->settings->get('theme_secondary_color')) ?? $primary;

        switch ($s['accent_mode']) {
            case 'off':
                return ['hex' => null, 'source' => 'off', 'contrast' => null];
            case 'custom':
                if ($s['accent_custom']) {
                    $rgb = ColorTools::hexToRgb($s['accent_custom']);

                    return ['hex' => $s['accent_custom'], 'source' => 'custom', 'contrast' => round(ColorTools::contrast($rgb, ColorTools::hexToRgb($bg)), 2)];
                }
                // özel renk girilmemişse otomatik davran
            case 'auto':
                $p = ColorTools::adaptForDark($primary, $bg);
                $q = ColorTools::adaptForDark($secondary, $bg);
                // Renkli (doygun) olanı ve daha az değişeni tercih et: gri tonlar ancak tek seçenekse
                $pScore = $p['shift'] + (ColorTools::saturation($primary) < 0.15 ? 1 : 0);
                $qScore = $q['shift'] + (ColorTools::saturation($secondary) < 0.15 ? 1 : 0);
                $pick = $qScore < $pScore ? $q : $p;

                return ['hex' => $pick['hex'], 'source' => $qScore < $pScore ? 'secondary' : 'primary', 'contrast' => $pick['contrast']];
            case 'secondary':
                $q = ColorTools::adaptForDark($secondary, $bg);

                return ['hex' => $q['hex'], 'source' => 'secondary', 'contrast' => $q['contrast']];
            case 'primary':
            default:
                $p = ColorTools::adaptForDark($primary, $bg);

                return ['hex' => $p['hex'], 'source' => 'primary', 'contrast' => $p['contrast']];
        }
    }

    public function build(): string
    {
        $s = $this->settings();
        $dark = 'html[data-theme^=dark]';
        $out = [];

        // 1–2. Değişkenler
        $vars = [];
        $accent = $this->accent($s);
        if ($accent['hex']) {
            $vars[] = '--primary-color:' . $accent['hex'];
            $vars[] = '--link-color:' . $accent['hex'];
            $vars[] = '--framio-dark-accent:' . $accent['hex'];
        }
        if ($s['palette']) {
            if ($s['bg']) $vars[] = '--body-bg:' . $s['bg'];
            if ($s['surface']) {
                $vars[] = '--control-bg:' . $s['surface'];
                $vars[] = '--framio-dm-surface:' . $s['surface'];
            }
            if ($s['text']) {
                $vars[] = '--text-color:' . $s['text'];
                $vars[] = '--heading-color:' . $s['text'];
            }
            if ($s['muted']) $vars[] = '--muted-color:' . $s['muted'];
        }
        $vars[] = '--framio-dm-border:color-mix(in srgb, var(--text-color) 14%, transparent)';
        if (!($s['palette'] && $s['surface'])) {
            $vars[] = '--framio-dm-surface:color-mix(in srgb, var(--body-bg) 92%, #fff)';
        }
        $out[] = $dark . '{' . implode(';', $vars) . '}';

        // Renkli başlık: çekirdek karanlıkta başlık zeminini ana renk, yazıyı karanlık zemin rengi
        // yapar; koyu ana renkli sitelerde başlıktaki her şey görünmez olur. Zemine göre yazı rengi seç.
        if ($s['header_fix'] && $this->settings->get('theme_colored_header')) {
            $out[] = $this->headerFix($dark);
        }

        // 3. Uyumluluk katmanı: ayardan bağımsız olduğu için önbellekli yama dosyasında (patchedStylesheetUrl)

        // 4. Özel CSS (yalnızca karanlıkta geçerli olacak şekilde sarılır)
        $custom = trim(str_replace('</style', '', $s['custom_css']));
        if ($custom !== '') {
            // CSS iç içe yazımı: kurallar yalnızca karanlık temada uygulanır
            $out[] = $dark . ' {' . $custom . '}';
        }

        return implode("\n", $out);
    }

    private function headerFix(string $dark): string
    {
        $primary = ColorTools::hexToRgb(ColorTools::normalizeHex($this->settings->get('theme_primary_color')) ?? '#4d698e');
        $lightText = ColorTools::contrast($primary, [255, 255, 255]) >= ColorTools::contrast($primary, [0, 0, 0]);

        $color = $lightText ? '#f2f2f2' : '#1a1a1a';
        $control = $lightText ? 'rgba(255,255,255,.88)' : 'rgba(0,0,0,.78)';
        $controlBg = $lightText ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.10)';
        $shaded = $lightText ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.16)';

        $vars = [
            '--header-color:' . $color,
            '--header-control-color:' . $control,
            '--header-control-bg:' . $controlBg,
            '--header-colored-color:' . $color,
            '--header-colored-control-color:' . $control,
            '--header-colored-control-bg:' . $controlBg,
            '--header-colored-control-bg-shaded:' . $shaded,
            '--header-colored-control-bg-fadedin:' . $shaded,
        ];

        return 'html[data-theme^=dark][data-colored-header=true]{' . implode(';', $vars) . '}';
    }

    private function compatLayer(string $dark): string
    {
        // Mithril stil nesneleri tarayıcıda "prop: rgb(r, g, b)" biçimine çevrilir; metin olarak
        // yazılmış stillerde hex aynen kalır. Seçiciler :is() içinde gruplanarak boyut küçük tutulur.
        $needles = function (array $hexes, string $prop): array {
            $out = [];
            foreach (array_unique(array_map('strtolower', $hexes)) as $hex) {
                $rgb = 'rgb(' . implode(', ', ColorTools::hexToRgb($hex)) . ')';
                // Metin olarak yazılmış stillerde kısa yazım da olabilir (#ffffff → #fff)
                $forms = [$prop . ': ' . $rgb, $prop . ': ' . $hex];
                if (preg_match('/^#(.)\1(.)\2(.)\3$/', $hex, $sh)) {
                    $forms[] = $prop . ': #' . $sh[1] . $sh[2] . $sh[3];
                }
                foreach ($forms as $n) {
                    if ($prop === 'color') {
                        // "background-color" ile karışmasın: başta ya da "; " sonrasında
                        $out[] = '[style^="' . $n . '"]';
                        $out[] = '[style*="; ' . $n . '"]';
                    } else {
                        $out[] = '[style*="' . $n . '"]';
                    }
                }
            }

            return array_values(array_unique($out));
        };
        $rule = fn (array $sels, string $decl) => $dark . ' :is(' . implode(',', $sels) . '){' . $decl . '}';

        $rules = [];
        $rules[] = $rule(array_merge($needles(self::NEUTRAL_BG, 'background'), $needles(self::NEUTRAL_BG, 'background-color')), 'background-color:var(--framio-dm-surface) !important');
        foreach (self::TINTED_BG as $hex) {
            $rules[] = $rule(array_merge($needles([$hex], 'background'), $needles([$hex], 'background-color')), 'background-color:color-mix(in srgb, ' . $hex . ' 14%, var(--control-bg)) !important');
        }
        $rules[] = $rule($needles(self::DARK_TEXT, 'color'), 'color:var(--text-color) !important');
        $rules[] = $rule($needles(self::MID_TEXT, 'color'), 'color:var(--muted-color) !important');
        foreach (self::DEEP_COLORED_TEXT as $hex) {
            $rules[] = $rule($needles([$hex], 'color'), 'color:color-mix(in srgb, ' . $hex . ' 50%, #fff) !important');
        }

        // Kenarlıklar: "border: 1px solid rgb(...)", "border-bottom: 1px dotted #ddd" vb.
        $border = [];
        foreach (array_unique(self::LIGHT_BORDER) as $hex) {
            $rgb = 'rgb(' . implode(', ', ColorTools::hexToRgb($hex)) . ')';
            foreach (['solid', 'dashed', 'dotted'] as $style) {
                $border[] = '[style*="' . $style . ' ' . $rgb . '"]';
                $border[] = '[style*="' . $style . ' ' . $hex . '"]';
            }
            $border[] = '[style*="border-color: ' . $rgb . '"]';
        }
        $rules[] = $rule(array_values(array_unique($border)), 'border-color:var(--framio-dm-border) !important');

        return implode("\n", $rules);
    }
}
