# Framio Security

Framio Security, tek tıkla sosyal oturum açma, parola güvenlik denetimi ve bot koruması sağlayan kapsamlı güvenlik paketidir.

## 🚀 Dahili Modüller ve Özellikler

- **OAuth (Sosyal Giriş):** Google, Facebook, GitHub, GitLab ve Discord üzerinden şifresiz tek tıkla kayıt ve giriş sağlar.
- **Pwned Passwords (Sızıntı Koruması):** HaveIBeenPwned API entegrasyonu ile ifşa olmuş zayıf şifrelerin kullanılmasını otomatik engeller.
- **ReCaptcha (Bot Koruması):** Kayıt ve giriş formlarına Google reCAPTCHA v2/v3 entegre ederek spam saldırılarını durdurur.

## 💻 Kurulum (Composer)

Bu paketi projenize dahil etmek için forum kök dizininde şu komutu çalıştırın:

`ash
composer require framio/security:*
`

## ⚙️ Yapılandırma ve Kullanım

Admin Paneli > Uzantılar > Framio Security sekmesinden OAuth sağlayıcı API anahtarlarınızı (Client ID/Secret) ve reCAPTCHA anahtarlarınızı girebilirsiniz.

## 📋 Sistem Gereksinimleri

- **Flarum Core:** ^2.0
- **PHP:** >=8.2

---

## 👨‍💻 Geliştirici Bilgileri

- **Geliştirici:** Framio-Dev
- **Web Sitesi:** [https://dev.framiomedia.com](https://dev.framiomedia.com)
- **Sürüm:** 1.0.0
- **Lisans:** MIT
