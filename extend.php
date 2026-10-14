<?php

/*
 * Flarum Gelişmiş SEO - Post Bazlı Dinamik Alt Etiketi
 * Her gönderiyi ayrı tarar ve o gönderideki listelerden (Firma, Plaka) veri çeker.
 */

use Flarum\Extend;
use Flarum\Frontend\Document;

return [
    new Extend\Locales(__DIR__.'/vendor/framio/engagement/modules/who-read/resources/locale'),

    (new Extend\Frontend('forum'))
        ->content(function (Document $document) {
            $document->foot[] = '
                <script>
                document.addEventListener("DOMContentLoaded", function() {
                    
                    function advancedAutoAltTags() {
                        // 1. Sayfa Başlığını Yedek Olarak Al (Eğer kullanıcı bilgi girmemişse bunu kullanacağız)
                        var globalTitleEl = document.querySelector(".Hero-titleContents h1");
                        var globalTitle = globalTitleEl ? globalTitleEl.innerText.trim() : "Spotters Turkey";

                        // 2. Sayfadaki TÜM gönderileri (Post-body) tek tek gez
                        var posts = document.querySelectorAll(".Post-body");

                        posts.forEach(function(post) {
                            // A. Bu gönderinin içindeki resimleri bul
                            var images = post.querySelectorAll("img");
                            if (images.length === 0) return; // Resim yoksa geç

                            // B. Bu gönderinin içindeki BİLGİ LİSTESİNİ (ul li) bul
                            // Sizin forum yapınızda bilgiler <ul><li>...</li></ul> içinde duruyor.
                            var listItems = post.querySelectorAll("ul li");
                            var specificText = "";

                            if (listItems.length > 0) {
                                // Listeleri topla: "Firma | Plaka" + "Model" + "Konum"
                                listItems.forEach(function(li) {
                                    specificText += li.innerText + " ";
                                });
                                
                                // Temizlik Yap: | işaretini, gereksiz boşlukları ve tireleri temizle
                                // Örnek Çıktı: "Malatya Beydağı Turizm 44 AER 444 Mercedes-Benz Travego 16 SHD"
                                specificText = specificText.replace(/\|/g, "").replace(/\//g, "").replace(/\s+/g, " ").trim();
                            }

                            // C. Eğer liste yoksa veya boşsa, genel Sayfa Başlığını kullan
                            var finalAltText = (specificText.length > 5) ? specificText : globalTitle + " - Detay";

                            // D. Bu gönderideki resimlere etiketi bas
                            images.forEach(function(img) {
                                // Sadece boş olanlara veya otomatik doldurduklarımıza işlem yap
                                if (!img.alt || img.alt === "" || img.alt.includes("Detay")) {
                                    img.alt = finalAltText;
                                    img.title = finalAltText;
                                }
                            });
                        });
                    }

                    // Flarum SPA olduğu için sayfa değişimlerini ve yeni yüklenen postları izle
                    const observer = new MutationObserver(function(mutations) {
                        // Performans için sürekli çalıştırma, sadece node eklendiğinde çalıştır
                        var shouldRun = false;
                        mutations.forEach(function(mutation) {
                            if (mutation.addedNodes.length) shouldRun = true;
                        });
                        
                        if (shouldRun) {
                            advancedAutoAltTags();
                        }
                    });

                    // Gözlemciyi başlat
                    observer.observe(document.body, { childList: true, subtree: true });

                    // İlk yüklemede çalıştır
                    setTimeout(advancedAutoAltTags, 500);
                });
                </script>';
        })
];