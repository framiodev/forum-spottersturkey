<?php

namespace Framio\UploadExif\Storage;

/**
 * Bir dosya adının gönderi içeriğinde görülebileceği bütün yazılış biçimleri.
 * Gönderilerde aynı ad ham, %-kodlu, yalnızca boşlukları %20 ve bunların HTML kaçışlı (&amp;) biçimleriyle
 * (ve karışımlarıyla) saklanabilir; adres değiştirme işlemleri bu biçimlerin hepsini kapsamalıdır.
 */
class UrlVariants
{
    /** @return array<int, callable(string): string> yazılış dönüşümleri */
    private static function transforms(): array
    {
        // Ayrılmış karakterlerin bir kısmı kodlanmadan bırakılmış olabilir (ör. & ham, boşluk ve parantez kodlu)
        $keep = fn (array $chars) => fn (string $s) => str_replace(
            array_map('rawurlencode', $chars), $chars, rawurlencode($s)
        );
        $encodings = [
            fn (string $s) => $s,
            fn (string $s) => rawurlencode($s),
            fn (string $s) => str_replace(' ', '%20', $s),
            $keep(['(', ')']),
            $keep(['&']),
            $keep(['&', '(', ')']),
            $keep(['&', "'", '(', ')', '!', '*', ',', ';', '=', '+', '$', '@']),
            $keep(["'", '(', ')', '!', '*', ',', ';', '=', '+', '$', '@']),
        ];
        $escapes = [
            fn (string $s) => $s,
            fn (string $s) => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8', false),
            fn (string $s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8', false),
        ];
        $all = [];
        foreach ($encodings as $enc) {
            foreach ($escapes as $esc) {
                $all[] = fn (string $s) => $esc($enc($s));
            }
        }

        return $all;
    }

    /** @return string[] benzersiz yazılış biçimleri */
    public static function of(string $name): array
    {
        return array_values(array_unique(array_map(fn ($t) => $t($name), self::transforms())));
    }

    /**
     * Eski ad → yeni ad eşlemesi (her yazılış biçimi aynı dönüşümle üretilmiş karşılığına).
     * $query yeni adın sonuna eklenir (ör. ?w=1024); HTML kaçışlı biçimlerde & → &amp; olarak.
     *
     * @return array<string,string>
     */
    public static function map(string $old, string $new, string $query = ''): array
    {
        $map = [];
        foreach (self::transforms() as $t) {
            $o = $t($old);
            $isEscaped = $t('&') !== '&';
            $target = $t($new) . ($query !== '' && $isEscaped ? str_replace('&', '&amp;', $query) : $query);
            if ($o !== $target && !isset($map[$o])) $map[$o] = $target;
        }

        return $map;
    }
}
