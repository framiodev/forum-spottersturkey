<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

// Hata gösterimini kapat (JSON yapısını bozmaması için)
error_reporting(0);

if (!isset($_GET['url'])) {
    echo json_encode(['error' => 'URL eksik']);
    exit;
}

$url = $_GET['url'];

// cURL kullanarak resmi sunucuya güvenle çek (Paylaşımlı hosting uyumlu)
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
$imageContent = curl_exec($ch);
curl_close($ch);

if (!$imageContent) {
    echo json_encode(['error' => 'Resim indirilemedi']);
    exit;
}

// Resmi okuyabilmek için geçici bir .jpg dosyası oluştur
$tempFile = sys_get_temp_dir() . '/exif_' . uniqid() . '.jpg';
file_put_contents($tempFile, $imageContent);

// PHP'nin yerleşik EXIF okuyucusu ile çekirdeğe in
$exif = @exif_read_data($tempFile);
unlink($tempFile); // Geçici dosyayı anında sil (Sunucuda yer kaplamaz)

if ($exif === false) {
    echo json_encode(['error' => 'EXIF bulunamadı', 'data' => []]);
    exit;
}

// Verileri toparla
$result = [
    'camera' => isset($exif['Model']) ? trim(($exif['Make'] ?? '') . ' ' . $exif['Model']) : '',
    'lens' => $exif['UndefinedTag:0xA434'] ?? $exif['LensModel'] ?? '',
    'shutter' => '',
    'aperture' => '',
    'iso' => isset($exif['ISOSpeedRatings']) ? $exif['ISOSpeedRatings'] : '',
    'focal' => '',
    'date' => ''
];

// Enstantane (Kesirli hesaplama)
if (isset($exif['ExposureTime'])) {
    $exp = explode('/', $exif['ExposureTime']);
    if (count($exp) == 2 && $exp[0] != 0 && $exp[1] != 0) {
        $val = $exp[0] / $exp[1];
        $result['shutter'] = ($val < 1) ? '1/' . round(1 / $val) : $val;
    } else {
        $result['shutter'] = $exif['ExposureTime'];
    }
}

// Diyafram (f/ değeri hesaplama)
if (isset($exif['FNumber'])) {
    $f = explode('/', $exif['FNumber']);
    if (count($f) == 2 && $f[1] != 0) {
        $result['aperture'] = 'f/' . round($f[0] / $f[1], 1);
    } else {
        $result['aperture'] = 'f/' . $exif['FNumber'];
    }
}

// Odak Uzaklığı
if (isset($exif['FocalLength'])) {
    $fl = explode('/', $exif['FocalLength']);
    if (count($fl) == 2 && $fl[1] != 0) {
        $result['focal'] = round($fl[0] / $fl[1], 1) . ' mm';
    } else {
        $result['focal'] = $exif['FocalLength'] . ' mm';
    }
}

// Çekim Tarihini Düzelt (YYYY:MM:DD -> DD.MM.YYYY)
if (isset($exif['DateTimeOriginal'])) {
    $dateObj = DateTime::createFromFormat('Y:m:d H:i:s', $exif['DateTimeOriginal']);
    if ($dateObj) {
        $result['date'] = $dateObj->format('d.m.Y H:i');
    }
}

echo json_encode(['success' => true, 'data' => $result]);
?>