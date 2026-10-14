<?php

namespace Framio\General\DarkMode;

/**
 * Karanlık mod için renk hesapları: hex ↔ rgb/hsl, göreli parlaklık, WCAG kontrastı
 * ve bir rengi tonunu koruyarak hedef kontrasta ulaşana dek açma.
 */
class ColorTools
{
    /** "#abc" / "#aabbcc" → [r, g, b]; geçersizse null */
    public static function hexToRgb(?string $hex): ?array
    {
        $hex = ltrim(trim((string) $hex), '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }
        if (!preg_match('/^[0-9a-f]{6}$/i', $hex)) {
            return null;
        }

        return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
    }

    public static function rgbToHex(array $rgb): string
    {
        return sprintf('#%02x%02x%02x', ...array_map(fn ($v) => max(0, min(255, (int) round($v))), $rgb));
    }

    public static function normalizeHex(?string $hex): ?string
    {
        $rgb = self::hexToRgb($hex);

        return $rgb ? self::rgbToHex($rgb) : null;
    }

    public static function luminance(array $rgb): float
    {
        $c = array_map(function ($v) {
            $v /= 255;

            return $v <= 0.03928 ? $v / 12.92 : (($v + 0.055) / 1.055) ** 2.4;
        }, $rgb);

        return 0.2126 * $c[0] + 0.7152 * $c[1] + 0.0722 * $c[2];
    }

    public static function contrast(array $a, array $b): float
    {
        $l1 = self::luminance($a);
        $l2 = self::luminance($b);

        return (max($l1, $l2) + 0.05) / (min($l1, $l2) + 0.05);
    }

    public static function rgbToHsl(array $rgb): array
    {
        [$r, $g, $b] = array_map(fn ($v) => $v / 255, $rgb);
        $max = max($r, $g, $b);
        $min = min($r, $g, $b);
        $l = ($max + $min) / 2;
        $h = $s = 0.0;

        if ($max !== $min) {
            $d = $max - $min;
            $s = $l > 0.5 ? $d / (2 - $max - $min) : $d / ($max + $min);
            if ($max === $r) {
                $h = ($g - $b) / $d + ($g < $b ? 6 : 0);
            } elseif ($max === $g) {
                $h = ($b - $r) / $d + 2;
            } else {
                $h = ($r - $g) / $d + 4;
            }
            $h /= 6;
        }

        return [$h, $s, $l];
    }

    public static function hslToRgb(array $hsl): array
    {
        [$h, $s, $l] = $hsl;
        if ($s == 0) {
            return [$l * 255, $l * 255, $l * 255];
        }
        $hue = function ($p, $q, $t) {
            if ($t < 0) $t += 1;
            if ($t > 1) $t -= 1;
            if ($t < 1 / 6) return $p + ($q - $p) * 6 * $t;
            if ($t < 1 / 2) return $q;
            if ($t < 2 / 3) return $p + ($q - $p) * (2 / 3 - $t) * 6;

            return $p;
        };
        $q = $l < 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
        $p = 2 * $l - $q;

        return [$hue($p, $q, $h + 1 / 3) * 255, $hue($p, $q, $h) * 255, $hue($p, $q, $h - 1 / 3) * 255];
    }

    /**
     * Tonu koruyarak rengi açar; arka plana karşı hedef kontrasta ulaşılan ilk tonu döndürür.
     * Renk zaten yeterince okunuyorsa aynen kalır.
     *
     * @return array{hex:string,shift:float,contrast:float}
     */
    public static function adaptForDark(string $hex, string $bgHex, float $target = 4.5): array
    {
        $rgb = self::hexToRgb($hex) ?? [128, 128, 128];
        $bg = self::hexToRgb($bgHex) ?? [26, 26, 26];

        if (self::contrast($rgb, $bg) >= $target) {
            return ['hex' => self::rgbToHex($rgb), 'shift' => 0.0, 'contrast' => round(self::contrast($rgb, $bg), 2)];
        }

        [$h, $s, $l] = self::rgbToHsl($rgb);
        $start = $l;
        // Çok doymuş renkler açıldıkça neona döner; doygunluğu bir miktar yumuşat
        $s = min($s, 0.85);
        for ($step = $l; $step <= 0.95; $step += 0.01) {
            $candidate = self::hslToRgb([$h, $s, $step]);
            if (self::contrast($candidate, $bg) >= $target) {
                return ['hex' => self::rgbToHex($candidate), 'shift' => round($step - $start, 3), 'contrast' => round(self::contrast($candidate, $bg), 2)];
            }
        }

        $fallback = self::hslToRgb([$h, $s, 0.85]);

        return ['hex' => self::rgbToHex($fallback), 'shift' => round(0.85 - $start, 3), 'contrast' => round(self::contrast($fallback, $bg), 2)];
    }

    public static function saturation(string $hex): float
    {
        $rgb = self::hexToRgb($hex);

        return $rgb ? self::rgbToHsl($rgb)[1] : 0.0;
    }
}
