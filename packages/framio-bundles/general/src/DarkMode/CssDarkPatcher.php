<?php

namespace Framio\General\DarkMode;

/**
 * Derlenmiş forum CSS'indeki sabit (değişken kullanmayan) açık renkleri bulur ve
 * yalnızca karanlık temada geçerli karşılıklarını üretir:
 *   açık zemin   → yüzey rengi (renkliyse tonu korunarak koyulaştırılır)
 *   koyu yazı    → metin rengi, gri yazı → soluk metin rengi
 *   açık kenarlık → karanlık temaya uygun kenarlık
 * Zaten temaya göre yazılmış kurallar (data-theme içeren seçiciler) ve var()/gradient/url()
 * kullanan değerler atlanır. Açık tema hiç etkilenmez.
 */
class CssDarkPatcher
{
    private const DARK = 'html[data-theme^=dark]';

    /** Yalnızca içine girilip işlenen at-kuralları */
    private const RECURSE_AT = ['@media', '@supports', '@container', '@layer', '@document'];

    public function patch(string $css): string
    {
        $css = preg_replace('~/\*.*?\*/~s', '', $css) ?? $css;

        return $this->renderItems($this->parse($css));
    }

    // ---------------------------------------------------------------- ayrıştırma

    private function parse(string $css): array
    {
        $items = [];
        $len = strlen($css);
        $i = 0;

        while ($i < $len) {
            // Başlangıç: { ya da ; kadar olan "prelude"
            $start = $i;
            $depthParen = 0;
            $quote = null;
            while ($i < $len) {
                $c = $css[$i];
                if ($quote) {
                    if ($c === '\\') { $i += 2; continue; }
                    if ($c === $quote) $quote = null;
                } elseif ($c === '"' || $c === "'") {
                    $quote = $c;
                } elseif ($c === '(') {
                    $depthParen++;
                } elseif ($c === ')') {
                    $depthParen--;
                } elseif ($depthParen <= 0 && ($c === '{' || $c === ';' || $c === '}')) {
                    break;
                }
                $i++;
            }
            if ($i >= $len) break;

            $prelude = trim(substr($css, $start, $i - $start));
            $c = $css[$i];

            if ($c === ';' || $c === '}') { // gövdesiz at-kuralı ya da artık
                $i++;
                continue;
            }

            // { ... } bloğunun sonunu bul
            $bodyStart = $i + 1;
            $end = $this->matchBrace($css, $i);
            $body = substr($css, $bodyStart, $end - $bodyStart);
            $i = $end + 1;

            if ($prelude === '') continue;

            if ($prelude[0] === '@') {
                $name = strtolower(strtok($prelude, " \t\n("));
                if (in_array($name, self::RECURSE_AT, true) && !preg_match('/\bprint\b/i', $prelude)) {
                    $items[] = ['at' => $prelude, 'children' => $this->parse($body)];
                }
                continue; // @font-face, @keyframes, @page, @property, print … atlanır
            }

            $items[] = ['sel' => $prelude, 'decl' => $body];
        }

        return $items;
    }

    private function matchBrace(string $css, int $open): int
    {
        $len = strlen($css);
        $depth = 0;
        $quote = null;
        for ($i = $open; $i < $len; $i++) {
            $c = $css[$i];
            if ($quote) {
                if ($c === '\\') { $i++; continue; }
                if ($c === $quote) $quote = null;
                continue;
            }
            if ($c === '"' || $c === "'") { $quote = $c; continue; }
            if ($c === '{') $depth++;
            elseif ($c === '}') {
                $depth--;
                if ($depth === 0) return $i;
            }
        }

        return $len;
    }

    // ---------------------------------------------------------------- üretim

    private function renderItems(array $items): string
    {
        $out = '';
        foreach ($items as $item) {
            if (isset($item['at'])) {
                $inner = $this->renderItems($item['children']);
                if ($inner !== '') $out .= $item['at'] . '{' . $inner . '}';
                continue;
            }
            if (stripos($item['sel'], 'data-theme') !== false) continue;

            $decls = $this->convert($item['decl']);
            if ($decls) {
                $out .= $this->prefix($item['sel']) . '{' . implode(';', $decls) . '}';
            }
        }

        return $out;
    }

    private function prefix(string $selector): string
    {
        $parts = [];
        foreach ($this->splitTop($selector, ',') as $p) {
            $p = trim($p);
            if ($p === '') continue;
            if (preg_match('/^(html|:root)\b/i', $p)) {
                $parts[] = self::DARK . substr($p, strlen(preg_match('/^html/i', $p) ? 'html' : ':root'));
            } else {
                $parts[] = self::DARK . ' ' . $p;
            }
        }

        return implode(',', $parts);
    }

    /** @return string[] dönüştürülmüş bildirimler */
    private function convert(string $body): array
    {
        $out = [];
        foreach ($this->splitTop($body, ';') as $decl) {
            $pos = strpos($decl, ':');
            if ($pos === false) continue;
            $prop = strtolower(trim(substr($decl, 0, $pos)));
            $value = trim(substr($decl, $pos + 1));
            $important = stripos($value, '!important') !== false ? ' !important' : '';
            $value = trim(str_ireplace('!important', '', $value));

            if ($value === '' || preg_match('/var\(|gradient|url\(|inherit|currentcolor|transparent|none/i', $value)) continue;

            if ($prop === 'background' || $prop === 'background-color') {
                $colors = $this->colors($value);
                if (count($colors) !== 1) continue;
                [$rgb, $alpha] = $colors[0];
                if ($alpha < 0.5 || ColorTools::luminance($rgb) < 0.72) continue;
                $hex = ColorTools::rgbToHex($rgb);
                // Renklilik: kanallar arası fark (HSL doygunluğu beyaza yakın tonlarda yanıltır)
                $chroma = max($rgb) - min($rgb);
                $out[] = 'background-color:' . ($chroma >= 20
                    ? 'color-mix(in srgb, ' . $hex . ' 14%, var(--control-bg))'
                    : 'var(--framio-dm-surface)') . $important;
            } elseif ($prop === 'color') {
                $colors = $this->colors($value);
                if (count($colors) !== 1) continue;
                [$rgb] = $colors[0];
                $l = ColorTools::luminance($rgb);
                $chroma = max($rgb) - min($rgb);
                if ($l < 0.03) {
                    $out[] = 'color:var(--text-color)' . $important;
                } elseif ($chroma >= 40 && $l < 0.2) {
                    $out[] = 'color:color-mix(in srgb, ' . ColorTools::rgbToHex($rgb) . ' 50%, #fff)' . $important;
                } elseif ($l < 0.12) {
                    $out[] = 'color:var(--text-color)' . $important;
                } elseif ($l < 0.3 && $chroma < 40) {
                    $out[] = 'color:var(--muted-color)' . $important;
                }
            } elseif (preg_match('/^border(-(top|right|bottom|left))?(-color)?$/', $prop)) {
                $colors = $this->colors($value);
                if (count($colors) !== 1) continue;
                [$rgb, $alpha] = $colors[0];
                if ($alpha < 0.3 || ColorTools::luminance($rgb) < 0.6) continue;
                $side = preg_match('/^border-(top|right|bottom|left)/', $prop, $m) ? '-' . $m[1] : '';
                $out[] = 'border' . $side . '-color:var(--framio-dm-border)' . $important;
            }
        }

        return $out;
    }

    /** Değerdeki renkler: [[r,g,b], alpha] listesi */
    private function colors(string $value): array
    {
        $found = [];
        if (preg_match_all('/#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/i', $value, $m)) {
            foreach ($m[1] as $h) {
                $alpha = 1.0;
                if (strlen($h) === 8) { $alpha = hexdec(substr($h, 6, 2)) / 255; $h = substr($h, 0, 6); }
                if (strlen($h) === 4) { $alpha = hexdec($h[3] . $h[3]) / 255; $h = substr($h, 0, 3); }
                $found[] = [ColorTools::hexToRgb($h), $alpha];
            }
        }
        if (preg_match_all('/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,\/]\s*([\d.]+%?))?\s*\)/i', $value, $m, PREG_SET_ORDER)) {
            foreach ($m as $g) {
                $a = isset($g[4]) && $g[4] !== '' ? (str_ends_with($g[4], '%') ? (float) $g[4] / 100 : (float) $g[4]) : 1.0;
                $found[] = [[(float) $g[1], (float) $g[2], (float) $g[3]], $a];
            }
        }
        if (preg_match('/(^|[\s,])(white)($|[\s,])/i', $value)) $found[] = [[255, 255, 255], 1.0];
        if (preg_match('/(^|[\s,])(black)($|[\s,])/i', $value)) $found[] = [[0, 0, 0], 1.0];

        return array_values(array_filter($found, fn ($f) => $f[0] !== null));
    }

    /** Parantez ve tırnak dışındaki ayırıcıya göre böler */
    private function splitTop(string $s, string $sep): array
    {
        $parts = [];
        $buf = '';
        $depth = 0;
        $quote = null;
        $len = strlen($s);
        for ($i = 0; $i < $len; $i++) {
            $c = $s[$i];
            if ($quote) {
                $buf .= $c;
                if ($c === $quote) $quote = null;
                continue;
            }
            if ($c === '"' || $c === "'") { $quote = $c; $buf .= $c; continue; }
            if ($c === '(' || $c === '[') $depth++;
            if ($c === ')' || $c === ']') $depth--;
            if ($c === $sep && $depth === 0) { $parts[] = $buf; $buf = ''; continue; }
            $buf .= $c;
        }
        if (trim($buf) !== '') $parts[] = $buf;

        return $parts;
    }
}
