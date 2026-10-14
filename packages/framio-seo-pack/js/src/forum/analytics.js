import { extend } from 'flarum/common/extend';
import Page from 'flarum/common/components/Page';

export default function () {
  // Sayfa her değiştiğinde veya yüklendiğinde çalışır
  extend(Page.prototype, 'oncreate', function () {
    const appElement = document.getElementById('app');

    // Olay Dinleyicisi (Event Listener) eklemediysek ekleyelim
    if (!appElement.dataset.analyticsAttached) {
      
      appElement.addEventListener('click', (e) => {
        const target = e.target;
        // const parent = target.parentElement; // Kullanılmadığı için sildim, temizlik olsun.

        // --- 1. FOTOĞRAF TIKLAMALARINI TAKİP ET ---
        if (target.tagName === 'IMG' && target.closest('.Post-body')) {
            
            // Avatar veya emoji olmadığından emin olalım
            if (target.classList.contains('Avatar') || target.classList.contains('emoji')) return;

            const imageUrl = target.src;
            const altText = target.alt || 'Tanımsız Görsel';
            
            // Medya eklentisinin görsel kapsayıcısı (framio-image-container vb.)
            const mediaContainer = target.closest('[class*="-image-container"]');
            const spotterId = mediaContainer ? mediaContainer.getAttribute('data-id') : 'legacy';

            // Google Analytics 4'e Olay Gönder
            if (typeof gtag === 'function') {
                gtag('event', 'view_photo', {
                    'event_category': 'Engagement',
                    'event_label': altText,
                    'image_url': imageUrl,
                    'spotter_id': spotterId
                });
                
                // console.log('GA4 Event Sent:', altText); // Konsol kirliliği olmasın diye kapattım
            }
        }

        // --- 2. KATEGORİ / ETİKET TIKLAMALARINI TAKİP ET ---
        if (target.closest('.TagLabel')) {
            const tagElement = target.closest('.TagLabel');
            const tagText = tagElement.innerText;
            const tagLink = tagElement.href;

            if (typeof gtag === 'function') {
                gtag('event', 'select_content', {
                    'content_type': 'category',
                    'item_id': tagText,
                    'link_url': tagLink
                });
            }
        }
      });

      appElement.dataset.analyticsAttached = 'true';
    }
  });
}