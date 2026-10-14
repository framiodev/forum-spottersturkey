# Framio Paket & Modül Yöneticisi (Framio Package Manager & Consolidator)

Framio Paket & Modül Yöneticisi, Flarum forumunuzda eklentileri ister konsolide paketlere dönüştürerek, ister yeni konsolide paketler oluşturarak, ister tamamen özelleştirilmiş kimlikle (özel isim, sürüm, yazar, ikon) bağımsız/izole olarak kurup yönetmenizi sağlayan hepsi-bir-arada yönetim eklentisidir.

## 🚀 Özellikler

1. **Konsolide Eklenti Dönüştürücü:**
   - Packagist veya ZIP'ten indirilen herhangi bir eklentiyi mevcut bir konsolide paketin (`framio/widgets`, `framio/community` vb.) içine anında alt modül olarak entegre eder.
   - `ModuleManager::conditional()` ile çalışma zamanında dinamik olarak bağlar.
   - Tek tıkla açılıp kapatılabilir; pasif modüller sıfır bellek tüketir.

2. **Yeni Konsolide Paket Sihirbazı:**
   - Tek tıkla sıfırdan yeni bir konsolide paket şablonu oluşturur (`packages/{yeni-paket}`).
   - Modülleri bu yeni paket altında gruplamanızı sağlar.

3. **İzole / Bağımsız Kurulum (Özelleştirilmiş Kimlik):**
   - Eklentiyi bağımsız olarak kurarken kimliğini özelleştirin:
     - Paket Adı (`framio/ozel-eklenti`)
     - Görünen Başlık & Açıklama
     - Sürüm Numarası (`1.0.0`)
     - Yazar Bilgisi & İkon / Renk
   - Flarum kök `composer.json` dosyasına yerel repository olarak kaydeder.

4. **Packagist Entegrasyonu & Keşfet:**
   - Flarum uzantılarını doğrudan yönetim panelinde arayın, inceleyin ve tek tıkla kurun.

5. **Modül Durum Kontrolü:**
   - Konsolide paketlerin içindeki tüm alt modülleri tek ekranda görün, canlı switch ile açıp kapatın.
   - Önbelleği temizleyin.

## 👨‍💻 Geliştirici Bilgileri
- **Geliştirici:** Framio-Dev
- **Web Sitesi:** https://dev.framiomedia.com
- **Sürüm:** 1.0.0
- **Lisans:** MIT
