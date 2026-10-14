# Spotters Turkey — Flarum 1.8 → 2.0 canlıya geçiş

Bu klasör (`tasinacak`) sitenin çalışması için gereken **tüm kod** dosyalarını içerir.
Kullanıcıların yüklediği dosyalar (avatarlar, eklenti dosyaları vb.) **bilinçli olarak yoktur**;
canlıdaki halleri korunur.

İçerik:

| Yol | Açıklama |
|---|---|
| `vendor/` | Tüm bağımlılıklar. Framio eklentileri gerçek kopya olarak içinde (symlink yok) → sunucuda `composer` gerekmez |
| `extend.php`, `site.php`, `index.php`, `flarum`, `composer.json` | Flarum 2 kök dosyaları |
| `.htaccess` | Yönlendirme + `storage/`, `vendor/`, `packages/`, `_kurulum/`, `composer.json` gibi hassas yolların web'den kapatılması |
| `get_exif.php`, `cron-seo.php` | Site ve cron tarafından kullanılan betikler |
| `storage/` | Boş klasör yapısı + Firebase anahtar dosyaları |
| `assets/watermarks/`, `assets/sehirici/` | İmza şablonları ve şehir hatları verisi |
| `_kurulum/rc_ayarlar.sql` | RC'de yapılan admin ayarları (menüler, imza şablonları, SEO, istatistik, eklenti listesi…) |
| `_kurulum/config.ornek.php` | `config.php` için gereken farklar |

> Not: `composer.lock` RC klasöründe artık yoktu. Sorun değil — `vendor/` hazır geliyor.
>
> **Inode tasarrufu:** `packages/` (kopyası zaten `vendor/` içinde), Google API kütüphanesinin kullanılmayan
> 667 servisi, Font Awesome SVG/JS paketleri, eklenti JS kaynak kodları ve `.map` dosyaları çıkarıldı.
> Bu yüzden sunucuda **`composer install/update` ÇALIŞTIRMAYIN**; eklenti kaynakları yerel RC klasöründe durur.

---

## 0. Yedek (atlamayın)

SSH ile forum klasöründe:

```bash
cd ~/forum.spottersturkey.com            # canlı forum klasörü (kendi yolunuz)
mysqldump -u KULLANICI -p VERITABANI > ~/yedek_$(date +%Y%m%d_%H%M).sql
tar czf ~/yedek_dosyalar_$(date +%Y%m%d_%H%M).tar.gz .
```

## 1. Bakım modu

`config.php` içine geçici olarak ekleyin: `'maintenance_mode' => 'high',` (yöneticiler dahil herkes bakım sayfası görür).
Alternatif: hosting panelinden siteyi geçici kapatın.

## 2. PHP sürümü

```bash
php -v
```
En az **PHP 8.2** olmalı. Değilse Güzel Hosting panelinden (PHP Seçici) 8.2+ seçin; SSH'deki
`php` farklıysa `/opt/alt/php82/usr/bin/php` gibi tam yolla çalıştırın (aşağıdaki tüm `php` komutlarında).
Gerekli PHP eklentileri: `intl`, `gd` (veya `imagick`), `exif`, `fileinfo`, `pdo_mysql`, `mbstring`, `curl`, `zip`.

## 3. Eski kodu kaldırın (kullanıcı dosyalarına DOKUNMADAN)

```bash
rm -rf vendor packages storage/cache storage/formatter storage/views storage/less storage/locale
```

**Silmeyin:** `config.php`, `assets/` (avatarlar, yüklemeler), `.well-known/`, `storage/logs`.

## 4. Dosyaları yükleyin

`tasinacak` klasörünün **içeriğini** zipleyin, forum klasörüne yükleyip açın (üzerine yaz):

```bash
unzip -o tasinacak.zip -d .
```

## 5. config.php

Canlıdaki `config.php`'yi koruyun, yalnızca `_kurulum/config.ornek.php`'deki farkları uygulayın:
- `'url' => 'https://forum.spottersturkey.com'`
- `'queue' => ['driver' => 'database']` bloğunu ekleyin
- `'debug' => false`

## 6. Veritabanı güncellemesi (sırası önemli)

```bash
php flarum migrate                                   # 1) Flarum 2 çekirdek tabloları
mysql -u KULLANICI -p VERITABANI < _kurulum/rc_ayarlar.sql   # 2) RC ayarları + eklenti listesi
php flarum migrate                                   # 3) eklentilerin tabloları (görsel kayıtları dahil)
```

2. adım eklenti listesini de getirdiği için 3. adımdaki `migrate` Framio eklentilerinin tablolarını kurar
ve eski `spotter_images` kayıtlarını otomatik olarak `framio_media_images` tablosuna aktarır.

## 7. Önbellek ve varlıklar

```bash
php flarum assets:publish
php flarum cache:clear
chmod -R 775 storage assets
```

## 8. Cron (hosting panelinde)

```
* * * * * cd /home/KULLANICI/forum.spottersturkey.com && php flarum schedule:run >> /dev/null 2>&1
* * * * * cd /home/KULLANICI/forum.spottersturkey.com && php flarum queue:work --stop-when-empty --max-time=55 >> /dev/null 2>&1
```
Mevcut `cron-seo.php` görevi aynen kalabilir.

## 9. Bakım modunu kapatın ve kontrol edin

`config.php`'den `maintenance_mode` satırını silin, sonra `php flarum cache:clear`.

Kontrol listesi:
- [ ] Ana sayfa, Akış, Galeri açılıyor
- [ ] Giriş / çıkış
- [ ] Konu açma ve yanıt yazma
- [ ] Fotoğraf yükleme + imza seçimi + künye (Firebase'e gidiyor mu)
- [ ] Eski konu adresleri (`/d/...`) ve eski görseller görünüyor
- [ ] Admin paneli ve eklenti ayarları
- [ ] Mobil görünüm
- [ ] `https://forum.spottersturkey.com/storage/service_account.json` → **403** vermeli
- [ ] `https://forum.spottersturkey.com/composer.json` → **403** vermeli

## 10. Temizlik

```bash
rm -rf _kurulum
```

## Notlar

- **Realtime (anlık bildirim/websocket)** kapalı gelir: paylaşımlı hostingde sürekli açık websocket sunucusu
  çalıştırılamaz ve çökerse paylaşımlar hata verir. Açmak için admin → Eklentiler → Realtime (yalnızca kalıcı
  bir websocket sunucusu çalıştırabiliyorsanız).
- **Forum başlığı** canlıdaki değerinde bırakıldı.

## Geri dönüş

Sorun olursa: dosyaları `yedek_dosyalar_*.tar.gz`'den, veritabanını `yedek_*.sql`'den geri yükleyin.
