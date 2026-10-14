<?php

namespace Framio\UploadExif\Image;

/**
 * Görsel meta verisini byte düzeyinde korur (yeniden kodlamada kayıp olmaması için).
 *
 *  - extractJpeg():   JPEG'deki EXIF (TIFF bloğu, üretici notları dahil), XMP, ICC renk profili ve IPTC'yi ham haliyle çıkarır
 *  - injectJpeg():    Bu blokları yeni kodlanmış bir JPEG'e geri yazar
 *  - patchExif():     Ham EXIF'te IFD0 metin etiketlerini (başlık, yazar, telif, XP etiketleri) ekler/değiştirir,
 *                     yönü 1 yapar ve gömülü küçük resmi kaldırır; diğer tüm etiketler olduğu gibi kalır
 *  - injectWebpIcc(): WebP dosyasına ICC renk profilini ekler (GD profili siler; geniş renk uzaylı fotoğraflarda renk kaymasını önler)
 *
 * Bütün işlemler bellekte yapılır, diske dosya yazılmaz.
 */
class ImageMeta
{
    private const EXIF_HEADER = "Exif\x00\x00";
    private const XMP_HEADER = "http://ns.adobe.com/xap/1.0/\x00";
    private const ICC_HEADER = "ICC_PROFILE\x00";
    private const IPTC_HEADER = "Photoshop 3.0\x00";
    private const MAX_SEGMENT = 65533; // uzunluk alanı dahil 65535

    /** @return array{exif:?string, xmp:?string, icc:?string, iptc:?string} */
    public static function extractJpeg(string $jpeg): array
    {
        $meta = ['exif' => null, 'xmp' => null, 'icc' => null, 'iptc' => null];
        if (substr($jpeg, 0, 2) !== "\xFF\xD8") return $meta;

        $iccChunks = [];
        foreach (self::segments($jpeg) as [$marker, $payload]) {
            if ($marker === 0xE1 && str_starts_with($payload, self::EXIF_HEADER) && $meta['exif'] === null) {
                $meta['exif'] = substr($payload, 6);
            } elseif ($marker === 0xE1 && str_starts_with($payload, self::XMP_HEADER) && $meta['xmp'] === null) {
                $meta['xmp'] = substr($payload, strlen(self::XMP_HEADER));
            } elseif ($marker === 0xE2 && str_starts_with($payload, self::ICC_HEADER)) {
                $seq = ord($payload[12] ?? "\x01");
                $iccChunks[$seq] = substr($payload, 14);
            } elseif ($marker === 0xED && str_starts_with($payload, self::IPTC_HEADER) && $meta['iptc'] === null) {
                $meta['iptc'] = $payload;
            }
        }
        if ($iccChunks) {
            ksort($iccChunks);
            $meta['icc'] = implode('', $iccChunks);
        }

        return $meta;
    }

    /** JPEG'in APP0/APP1/APP2/APP13 bölümlerini atar ve verilen meta verisini SOI'den hemen sonra yazar */
    public static function injectJpeg(string $jpeg, array $meta): string
    {
        if (substr($jpeg, 0, 2) !== "\xFF\xD8") return $jpeg;

        $out = "\xFF\xD8";
        // JFIF (APP0) uyumluluk için korunur, EXIF varsa gerekmez
        if (!empty($meta['exif'])) {
            $payload = self::EXIF_HEADER . $meta['exif'];
            if (strlen($payload) <= self::MAX_SEGMENT) $out .= self::segment(0xE1, $payload);
        }
        if (!empty($meta['xmp'])) {
            $payload = self::XMP_HEADER . $meta['xmp'];
            if (strlen($payload) <= self::MAX_SEGMENT) $out .= self::segment(0xE1, $payload);
        }
        if (!empty($meta['icc'])) {
            $parts = str_split($meta['icc'], self::MAX_SEGMENT - 14);
            $n = count($parts);
            foreach ($parts as $i => $part) {
                $out .= self::segment(0xE2, self::ICC_HEADER . chr($i + 1) . chr($n) . $part);
            }
        }
        if (!empty($meta['iptc']) && strlen($meta['iptc']) <= self::MAX_SEGMENT) {
            $out .= self::segment(0xED, $meta['iptc']);
        }

        // Kalan bölümler: eski meta bölümleri atlanır, gerisi (DQT, SOF, DHT, SOS ve görüntü verisi) aynen kopyalanır
        $pos = 2;
        $len = strlen($jpeg);
        while ($pos + 4 <= $len && $jpeg[$pos] === "\xFF") {
            $marker = ord($jpeg[$pos + 1]);
            if ($marker === 0xDA) break; // SOS: buradan sonrası görüntü verisi
            $segLen = unpack('n', substr($jpeg, $pos + 2, 2))[1];
            $isMeta = in_array($marker, [0xE1, 0xE2, 0xED], true) || ($marker === 0xE0 && !empty($meta['exif']));
            if (!$isMeta) $out .= substr($jpeg, $pos, $segLen + 2);
            $pos += $segLen + 2;
        }

        return $out . substr($jpeg, $pos);
    }

    /**
     * Ham EXIF (TIFF bloğu) üzerinde IFD0 etiketlerini değiştirir. IFD0 bloğun sonuna yeniden yazılır;
     * Exif/GPS alt dizinleri ve diğer tüm değerler yerinde kalır (ofsetler değişmez).
     *
     * @param array<int,string> $ascii  ASCII etiketler (0x010E açıklama, 0x013B sanatçı, 0x8298 telif ...)
     * @param array<int,string> $xp     Windows XP etiketleri (UTF-16LE: 0x9C9B başlık, 0x9C9C yorum, 0x9C9D yazar, 0x9C9E anahtar kelime, 0x9C9F konu)
     */
    public static function patchExif(string $tiff, array $ascii = [], array $xp = [], bool $resetOrientation = true, bool $dropThumbnail = true): ?string
    {
        if (strlen($tiff) < 8) return null;
        $order = substr($tiff, 0, 2);
        if ($order !== 'II' && $order !== 'MM') return null;
        $le = $order === 'II';
        $u16 = fn (string $b) => unpack($le ? 'v' : 'n', $b)[1];
        $u32 = fn (string $b) => unpack($le ? 'V' : 'N', $b)[1];
        $p16 = fn (int $v) => pack($le ? 'v' : 'n', $v);
        $p32 = fn (int $v) => pack($le ? 'V' : 'N', $v);

        $ifd0 = $u32(substr($tiff, 4, 4));
        if ($ifd0 + 2 > strlen($tiff)) return null;
        $count = $u16(substr($tiff, $ifd0, 2));
        if ($ifd0 + 2 + $count * 12 + 4 > strlen($tiff)) return null;

        $entries = [];
        for ($i = 0; $i < $count; $i++) {
            $raw = substr($tiff, $ifd0 + 2 + $i * 12, 12);
            $entries[$u16(substr($raw, 0, 2))] = $raw;
        }
        $next = $dropThumbnail ? 0 : $u32(substr($tiff, $ifd0 + 2 + $count * 12, 4));

        if ($resetOrientation && isset($entries[0x0112])) {
            // SHORT, 1 değer: değer alanının ilk 2 baytı
            $entries[0x0112] = substr($entries[0x0112], 0, 8) . $p16(1) . "\x00\x00";
        }

        $out = $tiff;
        $newValue = function (int $tag, int $type, string $data) use (&$out, &$entries, $p16, $p32) {
            $countVal = $type === 1 ? strlen($data) : strlen($data); // ASCII(2) ve BYTE(1): bayt sayısı
            if (strlen($data) <= 4) {
                $entries[$tag] = $p16($tag) . $p16($type) . $p32($countVal) . str_pad($data, 4, "\x00");
                return;
            }
            if (strlen($out) % 2) $out .= "\x00"; // kelime hizası
            $offset = strlen($out);
            $out .= $data;
            $entries[$tag] = $p16($tag) . $p16($type) . $p32($countVal) . $p32($offset);
        };

        foreach ($ascii as $tag => $text) {
            if ($text === null || $text === '') continue;
            $newValue($tag, 2, self::toLatin($text) . "\x00");
        }
        foreach ($xp as $tag => $text) {
            if ($text === null || $text === '') continue;
            $newValue($tag, 1, mb_convert_encoding($text, 'UTF-16LE', 'UTF-8') . "\x00\x00");
        }

        // Dahili küçük resim kaldırıldıysa ona ait IFD0 dışı veriler önemsizdir; yeni IFD0'ı sona yaz
        ksort($entries);
        if (strlen($out) % 2) $out .= "\x00";
        $newIfd0 = strlen($out);
        $out .= $p16(count($entries)) . implode('', $entries) . $p32($next);
        $out = substr($out, 0, 4) . $p32($newIfd0) . substr($out, 8);

        return strlen(self::EXIF_HEADER . $out) <= self::MAX_SEGMENT ? $out : null;
    }

    /**
     * WebP'ye EXIF (TIFF bloğu), XMP ve ICC ekler (indirme için). Var olan EXIF/XMP/ICC parçaları değiştirilir.
     * Parça sırası WebP belirtimine uygundur: VP8X, ICCP, görüntü, EXIF, XMP.
     */
    public static function injectWebpMeta(string $webp, array $meta, int $width, int $height): string
    {
        if (substr($webp, 0, 4) !== 'RIFF' || substr($webp, 8, 4) !== 'WEBP') return $webp;

        // Parçaları ayrıştır
        $chunks = [];
        $pos = 12;
        $len = strlen($webp);
        while ($pos + 8 <= $len) {
            $fourcc = substr($webp, $pos, 4);
            $size = unpack('V', substr($webp, $pos + 4, 4))[1];
            $chunks[] = [$fourcc, substr($webp, $pos + 8, $size)];
            $pos += 8 + $size + ($size % 2);
        }

        $vp8xFlags = 0;
        $image = [];
        foreach ($chunks as [$fourcc, $data]) {
            if ($fourcc === 'VP8X') {
                $vp8xFlags = ord($data[0]);
            } elseif (!in_array($fourcc, ['ICCP', 'EXIF', 'XMP '], true)) {
                $image[] = [$fourcc, $data];
                if ($fourcc === 'VP8L') $vp8xFlags |= 0x10;
            }
        }

        $icc = $meta['icc'] ?? null;
        $exif = $meta['exif'] ?? null;
        $xmp = $meta['xmp'] ?? null;
        $flags = ($vp8xFlags & 0x12) | ($icc ? 0x20 : 0) | ($exif ? 0x08 : 0) | ($xmp ? 0x04 : 0);

        $chunk = fn (string $fourcc, string $data) => $fourcc . pack('V', strlen($data)) . $data . (strlen($data) % 2 ? "\x00" : '');
        $body = 'WEBP' . $chunk('VP8X', chr($flags) . "\x00\x00\x00" . substr(pack('V', $width - 1), 0, 3) . substr(pack('V', $height - 1), 0, 3));
        if ($icc) $body .= $chunk('ICCP', $icc);
        foreach ($image as [$fourcc, $data]) $body .= $chunk($fourcc, $data);
        if ($exif) $body .= $chunk('EXIF', $exif);
        if ($xmp) $body .= $chunk('XMP ', $xmp);

        return 'RIFF' . pack('V', strlen($body)) . $body;
    }

    /** WebP'ye ICC profili ekler (VP8X kapsayıcısı ile). Profil sRGB ise ya da dosya zaten profilliyse dokunmaz. */
    public static function injectWebpIcc(string $webp, ?string $icc, int $width, int $height): string
    {
        if (!$icc || substr($webp, 0, 4) !== 'RIFF' || substr($webp, 8, 4) !== 'WEBP' || self::isSrgb($icc)) return $webp;

        $chunks = substr($webp, 12);
        $type = substr($chunks, 0, 4);
        if ($type === 'VP8X') {
            $flags = ord($chunks[8]);
            if ($flags & 0x20) return $webp; // zaten ICC var
            $vp8xLen = unpack('V', substr($chunks, 4, 4))[1];
            $vp8x = substr($chunks, 0, 8 + $vp8xLen);
            $vp8x[8] = chr($flags | 0x20);
            $rest = substr($chunks, 8 + $vp8xLen);
        } else {
            $alpha = $type === 'VP8L' ? 0x10 : 0; // kayıpsız biçimde saydamlık olabilir; işaret zararsızdır
            $vp8x = 'VP8X' . pack('V', 10) . chr(0x20 | $alpha) . "\x00\x00\x00"
                . substr(pack('V', $width - 1), 0, 3) . substr(pack('V', $height - 1), 0, 3);
            $rest = $chunks;
        }

        $iccp = 'ICCP' . pack('V', strlen($icc)) . $icc . (strlen($icc) % 2 ? "\x00" : '');
        $body = 'WEBP' . $vp8x . $iccp . $rest;

        return 'RIFF' . pack('V', strlen($body)) . $body;
    }

    /**
     * APP13 (Photoshop 3.0 / IPTC) bölümü oluşturur. Orijinal IPTC verilirse onun kayıtları korunur,
     * yalnızca $tags içindeki alanlar değiştirilir. Karakter seti UTF-8 olarak işaretlenir.
     *
     * @param array<string,string|string[]> $tags  'kayıt:alan' => değer (örn. '2:05' başlık)
     */
    public static function buildIptc(array $tags, ?string $originalApp13 = null): string
    {
        $records = [];
        if ($originalApp13 && ($block = self::findIptcBlock($originalApp13)) !== null) {
            $pos = 0;
            $len = strlen($block);
            while ($pos + 5 <= $len && $block[$pos] === "\x1C") {
                $rec = ord($block[$pos + 1]);
                $ds = ord($block[$pos + 2]);
                $size = unpack('n', substr($block, $pos + 3, 2))[1];
                if ($size & 0x8000) break; // genişletilmiş boyut: desteklenmiyor, burada dur
                $records[] = [$rec, $ds, substr($block, $pos + 5, $size)];
                $pos += 5 + $size;
            }
        }

        $override = [];
        foreach ($tags as $key => $val) {
            [$r, $d] = array_map('intval', explode(':', $key));
            $override["$r:$d"] = true;
        }
        $records = array_values(array_filter($records, fn ($x) => !isset($override["{$x[0]}:{$x[1]}"]) && !($x[0] === 1 && $x[1] === 90)));

        $data = "\x1C\x01\x5A\x00\x03\x1B\x25\x47"; // 1:90 karakter seti = UTF-8
        foreach ($records as [$r, $d, $v]) {
            $data .= "\x1C" . chr($r) . chr($d) . pack('n', strlen($v)) . $v;
        }
        foreach ($tags as $key => $val) {
            [$r, $d] = array_map('intval', explode(':', $key));
            foreach ((array) $val as $v) {
                $v = (string) $v;
                if ($v === '') continue;
                $v = substr($v, 0, 32000);
                $data .= "\x1C" . chr($r) . chr($d) . pack('n', strlen($v)) . $v;
            }
        }

        $resource = '8BIM' . pack('n', 0x0404) . "\x00\x00" . pack('N', strlen($data)) . $data . (strlen($data) % 2 ? "\x00" : '');

        return self::IPTC_HEADER . $resource;
    }

    private static function findIptcBlock(string $app13): ?string
    {
        $pos = str_starts_with($app13, self::IPTC_HEADER) ? strlen(self::IPTC_HEADER) : 0;
        $len = strlen($app13);
        while ($pos + 12 <= $len && substr($app13, $pos, 4) === '8BIM') {
            $id = unpack('n', substr($app13, $pos + 4, 2))[1];
            $nameLen = ord($app13[$pos + 6]);
            $nameField = 1 + $nameLen + ((1 + $nameLen) % 2);
            $sizePos = $pos + 6 + $nameField;
            $size = unpack('N', substr($app13, $sizePos, 4))[1];
            $dataPos = $sizePos + 4;
            if ($id === 0x0404) return substr($app13, $dataPos, $size);
            $pos = $dataPos + $size + ($size % 2);
        }

        return null;
    }

    public static function isSrgb(string $icc): bool
    {
        // Profil açıklaması (desc etiketi) sRGB içeriyorsa standart sRGB sayılır
        return (bool) preg_match('/s\x00?R\x00?G\x00?B/', substr($icc, 0, 2048));
    }

    /** JPEG bölümleri: [marker, payload] (SOS'ta durur) */
    private static function segments(string $jpeg): \Generator
    {
        $pos = 2;
        $len = strlen($jpeg);
        while ($pos + 4 <= $len && $jpeg[$pos] === "\xFF") {
            $marker = ord($jpeg[$pos + 1]);
            if ($marker === 0xDA || $marker === 0xD9) return;
            if ($marker === 0x01 || ($marker >= 0xD0 && $marker <= 0xD7)) { $pos += 2; continue; }
            $segLen = unpack('n', substr($jpeg, $pos + 2, 2))[1];
            yield [$marker, substr($jpeg, $pos + 4, $segLen - 2)];
            $pos += $segLen + 2;
        }
    }

    private static function segment(int $marker, string $payload): string
    {
        return "\xFF" . chr($marker) . pack('n', strlen($payload) + 2) . $payload;
    }

    private static function toLatin(string $text): string
    {
        // ASCII etiketler Türkçe karakter taşımaz; okunabilir karşılıklara çevrilir (tam metin XP/IPTC/XMP alanlarında UTF-8/16 olarak durur)
        $map = ['ç' => 'c', 'Ç' => 'C', 'ğ' => 'g', 'Ğ' => 'G', 'ı' => 'i', 'İ' => 'I', 'ö' => 'o', 'Ö' => 'O', 'ş' => 's', 'Ş' => 'S', 'ü' => 'u', 'Ü' => 'U', '©' => '(c)', '®' => '(R)', '™' => '(TM)'];
        $text = strtr($text, $map);

        return preg_replace('/[^\x20-\x7E\n]/', '', $text);
    }
}
