# Framio PWA

Framio PWA, Flarum 2.0 forum sitenizi mobil cihazlarda (iOS, Android) ve masaüstünde doğrudan yüklenebilir, tam teşekküllü bir **Progressive Web App (İlerici Web Uygulaması)** ve **Web Push Bildirim** platformuna dönüştürür.

## 🚀 Dahili Özellikler ve Modüller

- **Yüklenebilir Web Uygulaması (App Manifest):** Tarayıcıların 'Ana Ekrana Ekle' ve 'Uygulama Olarak Yükle' istemlerini otomatik tetikler.
- **Service Worker & Çevrimdışı Mod:** Sayfa önbellekleme ve bağlantı koptuğunda özel çevrimdışı (offline) bilgilendirme ekranı sunar.
- **Web Push Bildirimleri (VAPID):** Üyelerin tarayıcısı veya uygulaması kapalıyken bile telefonlarına ve bilgisayarlarına doğrudan anlık sistem bildirimleri gönderir.
- **Firebase Entegrasyonu:** Apple App Store ve iOS cihazlarda push bildirim desteğini en üst seviyeye çıkarmak için Firebase Messaging desteği.
- **Logo ve İkon Yönetimi:** Tüm cihaz çözünürlükleri için (192x192, 512x512 vb.) dinamik ikon ve tema renkleri yönetimi.

## 💻 Kurulum (Composer)

Bu paketi projenize dahil etmek için forum kök dizininde şu komutu çalıştırın:

```bash
composer require framio/pwa:*
```

## ⚙️ Yapılandırma ve Kullanım

1. **Admin Paneli > Uzantılar > Framio PWA** sekmesine gidin.
2. Forumunuzun kısa adı, tema rengi ve uygulama logolarını yükleyin.
3. VAPID anahtarlarınızı oluşturun (Sistem otomatik olarak ilk kurulumda anahtarları üretir).
4. İsteğe bağlı olarak Firebase Servis Hesabı JSON dosyanızı yükleyerek genişletilmiş bildirimleri aktif edin.

## 📋 Sistem Gereksinimleri

- **Flarum Core:** ^2.0.0-rc.8
- **PHP:** >=8.3 (GMP ve Sodium eklentileri aktif olmalıdır)
- **HTTPS:** PWA ve Web Push standartları gereğince sitenizin geçerli bir SSL/HTTPS sertifikasına sahip olması zorunludur.

---

## 👨‍💻 Geliştirici Bilgileri

- **Geliştirici:** Framio-Dev
- **Web Sitesi:** [https://dev.framiomedia.com](https://dev.framiomedia.com)
- **Sürüm:** 1.0.0
- **Lisans:** MIT
