import Modal from 'flarum/common/components/Modal';
import app from 'flarum/forum/app';
import DownloadChoice from './DownloadChoice';

export default class ExifLightboxModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);

    this.items = this.attrs.items || [];
    if (this.items.length === 0 && (this.attrs.imageUrl || this.attrs.data)) {
      this.items = [{
        photoId: this.attrs.photoId || (this.attrs.data ? this.attrs.data.id : null),
        imageUrl: this.attrs.imageUrl,
        data: this.attrs.data || {},
        post: this.attrs.post,
        containerEl: this.attrs.containerEl,
        displayTitle: this.attrs.displayTitle,
        cleanHtml: this.attrs.cleanHtml
      }];
    }

    this.currentIndex = typeof this.attrs.currentIndex === 'number' ? this.attrs.currentIndex : 0;
    if (this.currentIndex < 0 || this.currentIndex >= this.items.length) {
      this.currentIndex = 0;
    }

    this.loading = false;
    this.showShareMenu = false;
    /** Tamamen inmiş büyük görseller (geçiş tekrar oynamasın) */
    this.loadedUrls = new Set();

    // Keyboard listener for Left/Right arrow keys
    this.keyHandler = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'Left') {
        e.preventDefault();
        this.prev();
      } else if (e.key === 'ArrowRight' || e.key === 'Right') {
        e.preventDefault();
        this.next();
      }
    };
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    window.addEventListener('keydown', this.keyHandler);
    this.processCurrentItem();
  }

  onremove(vnode) {
    super.onremove(vnode);
    window.removeEventListener('keydown', this.keyHandler);
  }

  className() {
    return 'ExifLightboxModal Modal--large';
  }

  title() {
    return null;
  }

  extractPostDetails(cur) {
    if (!cur) return { cleanHtml: '', displayTitle: '', postNumber: 1 };

    let rawHtml = '';
    let postNumber = 1;
    const container = cur.containerEl || (cur.photoId ? document.querySelector(`[data-id="${cur.photoId}"]`) : null);

    // 1. DOM Post elementini bul
    const postEl = container ? (container.closest('.Post') || container.closest('.CommentPost') || container.closest('.PostStream-item')) : null;
    const streamItem = container ? container.closest('.PostStream-item') : null;

    // Post Numarasını Tespit Et
    if (postEl && postEl.getAttribute('data-number')) {
      postNumber = parseInt(postEl.getAttribute('data-number'), 10);
    } else if (streamItem && streamItem.getAttribute('data-index') !== null) {
      postNumber = parseInt(streamItem.getAttribute('data-index'), 10) + 1;
    } else if (streamItem && streamItem.getAttribute('data-number')) {
      postNumber = parseInt(streamItem.getAttribute('data-number'), 10);
    } else if (cur.post && typeof cur.post.number === 'function') {
      postNumber = cur.post.number();
    } else if (postEl && postEl.getAttribute('data-id')) {
      const pId = postEl.getAttribute('data-id');
      if (app.store) {
        const storedPost = app.store.getById('posts', pId);
        if (storedPost && storedPost.number) postNumber = storedPost.number();
      }
      if (app.current && app.current.data && app.current.data.discussion) {
        const disc = app.current.data.discussion;
        if (disc.postIds) {
          const idx = disc.postIds().indexOf(parseInt(pId, 10));
          if (idx !== -1) postNumber = idx + 1;
        }
      }
    }

    // Eğer halen 1 kaldıysa ve listede birden fazla stream item varsa DOM sırasına bak
    if (postNumber === 1 && streamItem) {
      const allStreamItems = Array.from(document.querySelectorAll('.PostStream-item'));
      const idx = allStreamItems.indexOf(streamItem);
      if (idx !== -1) postNumber = idx + 1;
    }

    // 2. Künye HTML'ini çek
    if (postEl) {
      const postBody = postEl.querySelector('.Post-body');
      if (postBody) {
        const clone = postBody.cloneNode(true);
        clone.querySelectorAll('.framio-image-container, .ulasimarsiv-image-container, .SpotterCard, .spotter-exif-placeholder, figure, img, hr, .Post-mentionedBy, script, style').forEach(n => n.remove());
        rawHtml = clone.innerHTML.trim();
      }
    }

    // Fallback: Post Modelinden HTML çek
    const post = cur.post;
    if (!rawHtml && post) {
      let contentHtml = (typeof post.contentHtml === 'function' ? post.contentHtml() : post.contentHtml) || '';
      if (contentHtml) {
        const temp = document.createElement('div');
        temp.innerHTML = contentHtml;
        temp.querySelectorAll('.framio-image-container, .ulasimarsiv-image-container, .SpotterCard, .spotter-exif-placeholder, figure, img, hr, .Post-mentionedBy, script, style').forEach(n => n.remove());
        rawHtml = temp.innerHTML.trim();
      }
    }

    // Künye HTML'ini temizle
    let cleanHtml = rawHtml.replace(/^(?:<br\s*\/?>\s*)+|(?:<br\s*\/?>\s*)+$/gi, '').trim();

    // Künyeden estetik başlık çıkart
    let extractedTitle = null;
    if (cleanHtml) {
      const temp = document.createElement('div');
      temp.innerHTML = cleanHtml;
      
      const lis = temp.querySelectorAll('li');
      if (lis.length >= 2) {
        let company = lis[0].textContent.trim();
        if (company.includes('|')) company = company.split('|')[0].trim();
        else if (company.includes(' - ')) company = company.split(' - ')[0].trim();
        extractedTitle = `${company} & ${lis[1].textContent.trim()}`;
      } else if (lis.length === 1) {
        extractedTitle = lis[0].textContent.trim();
      }

      if (!extractedTitle) {
        const strongs = temp.querySelectorAll('strong, b');
        if (strongs.length >= 2) {
          let company = strongs[0].textContent.trim();
          if (company.includes('|')) company = company.split('|')[0].trim();
          else if (company.includes(' - ')) company = company.split(' - ')[0].trim();
          extractedTitle = `${company} & ${strongs[1].textContent.trim()}`;
        }
      }

      if (!extractedTitle) {
        const htmlLines = temp.innerHTML.split(/<br\s*\/?>|<\/p>|<\/div>|\n/i);
        const textLines = htmlLines.map(l => {
          const div = document.createElement('div');
          div.innerHTML = l;
          return div.textContent.trim().replace(/^[-•*]+\s*/, '').trim(); 
        }).filter(l => l.length > 2 && !l.includes('[framio-image') && !l.includes('[spotter'));

        if (textLines.length >= 2) {
          let company = textLines[0];
          if (company.includes('|')) company = company.split('|')[0].trim();
          else if (company.includes(' - ')) company = company.split(' - ')[0].trim();
          extractedTitle = `${company} & ${textLines[1]}`;
        } else if (textLines.length === 1) {
          extractedTitle = textLines[0];
        }
      }
    }

    // Fallback: Tartışma başlığı
    if (!extractedTitle) {
      if (post && typeof post.discussion === 'function' && post.discussion()) {
        const discussion = post.discussion();
        if (discussion && discussion.title && !discussion.title().toLowerCase().includes('fotoğraf')) {
          extractedTitle = discussion.title();
        }
      }
      if (!extractedTitle && app.current && app.current.data && app.current.data.discussion) {
        const d = app.current.data.discussion;
        if (d.title && !d.title().toLowerCase().includes('fotoğraf')) {
          extractedTitle = d.title();
        }
      }
    }

    return {
      cleanHtml,
      displayTitle: extractedTitle,
      postNumber: postNumber || 1
    };
  }

  updateUrl(postNumber) {
    if (!postNumber) return;
    try {
      const currentPath = window.location.pathname;
      const match = currentPath.match(/^(\/d\/\d+[^\/]*)(?:\/\d+)?$/);
      if (match) {
        const basePath = match[1];
        const newPath = `${basePath}/${postNumber}`;
        if (window.location.pathname !== newPath) {
          window.history.replaceState(null, '', newPath + window.location.search + window.location.hash);
        }
      }
    } catch(e) {
      console.warn('URL update error:', e);
    }
  }

  copyTextToClipboard(text, successMsg = 'Bağlantı panoya kopyalandı!') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        app.alerts.show({ type: 'success' }, successMsg);
      }).catch(() => {
        this.fallbackCopyText(text, successMsg);
      });
    } else {
      this.fallbackCopyText(text, successMsg);
    }
  }

  fallbackCopyText(text, successMsg) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      app.alerts.show({ type: 'success' }, successMsg);
    } catch (e) {
      prompt('Bağlantı:', text);
    }
  }

  downloadPhoto(cur) {
    if (!cur) return;
    const photoId = cur.photoId || (cur.data ? cur.data.id : null);
    
    if (photoId) {
      // Backend streaming endpoint (attachment headers)
      const downloadUrl = app.forum.attribute('apiUrl') + '/framio-media/download/' + photoId;
      const a = document.createElement('a');
      a.href = downloadUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      app.alerts.show({ type: 'success' }, 'Fotoğraf indiriliyor...');
    } else {
      const directUrl = cur.imageUrl || (cur.data ? (cur.data.url || cur.data.path) : '');
      if (directUrl) {
        const a = document.createElement('a');
        a.href = directUrl;
        a.setAttribute('download', 'ulasim_fotograf.jpg');
        a.setAttribute('target', '_blank');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  }

  /**
   * Hemen gösterilecek küçük görsel: mesajdaki (tarayıcıda zaten yüklü) görsel,
   * yoksa kaydın küçük resmi. Lightbox boş açılmasın diye.
   */
  placeholderUrl(cur) {
    if (!cur) return '';
    if (!cur.placeholder) {
      const img = cur.containerEl && cur.containerEl.querySelector ? cur.containerEl.querySelector('img') : null;
      const data = cur.data || {};
      cur.placeholder = (img && (img.currentSrc || img.src)) || data.thumb_url || data.thumb_path || '';
    }
    return cur.placeholder;
  }

  /**
   * Lightbox'ta gösterilecek büyük görsel. Görsel en fazla 1024 px genişliğinde
   * gösterildiği için ~3840 px'lik ana dosya yerine, CDN dinamik boyutlandırma
   * açıksa ekrana uygun genişlik istenir.
   */
  displayUrl(cur) {
    const data = (cur && cur.data) || {};
    const main = String((cur && cur.imageUrl) || data.url || data.path || '').replace(/\?w=\d+$/, '');
    if (!main) return '';
    // "Yüksek Kalite" açıksa tam boyut (3840) dosya
    if (cur.hq) return main;

    const thumb = String(data.thumb_url || data.thumb_path || '');
    if (thumb.indexOf('?w=') !== -1) {
      // CDN dinamik boyutlandırma: ekrana uygun genişlik (en fazla 2048, retina için)
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.min(2048, Math.ceil((Math.min(window.innerWidth, 1024) * dpr) / 256) * 256);
      return main + '?w=' + w;
    }
    // Statik modda 1024 px küçük resim dosyası (lightbox'ta gösterilen boyut)
    return thumb || main;
  }

  /** Bu fotoğrafın ayrıca yüksek kalite (tam boyut) dosyası var mı */
  hasHq(cur) {
    const data = (cur && cur.data) || {};
    const main = String((cur && cur.imageUrl) || data.url || data.path || '').replace(/\?w=\d+$/, '');
    return !!main && main !== this.displayUrl(Object.assign({}, cur, { hq: false }));
  }

  /** Sonraki ve önceki fotoğrafı arka planda indir: oklarla geçişte bekleme olmasın */
  preloadNeighbours() {
    if (this.items.length < 2) return;
    [1, -1].forEach((step) => {
      const it = this.items[(this.currentIndex + step + this.items.length) % this.items.length];
      const url = this.displayUrl(it);
      if (url && !this.loadedUrls.has(url)) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => this.loadedUrls.add(url);
        img.src = url;
      }
    });
  }

  processCurrentItem() {
    const cur = this.items[this.currentIndex];
    if (!cur) return;

    // Detayları çıkart ve cache'le
    const details = this.extractPostDetails(cur);
    cur.cleanHtml = details.cleanHtml;
    cur.displayTitle = details.displayTitle;
    cur.postNumber = details.postNumber;

    // URL'deki post numarasını güncelle
    this.updateUrl(cur.postNumber);

    // Eğer EXIF verisi henüz yoksa API'den yükle
    if (!cur.data && cur.photoId) {
      this.loading = true;
      app.request({
        method: 'GET',
        url: app.forum.attribute('apiUrl') + '/framio-media/image/' + cur.photoId
      }).then(res => {
        cur.data = res;
        this.loading = false;
        m.redraw();
      }).catch(err => {
        this.loading = false;
        m.redraw();
      });
    }
  }

  /** Aynı mesajın fotoğrafları arasında (başa/sona dönerek) */
  goInPost(sameIdx, dir) {
    const pos = sameIdx.indexOf(this.currentIndex);
    this.showShareMenu = false;
    this.currentIndex = sameIdx[(pos + dir + sameIdx.length) % sameIdx.length];
    this.processCurrentItem();
    m.redraw();
  }

  /** Önceki / sonraki mesaj (o mesajın ilk fotoğrafı) */
  goPost(dir) {
    if (this.items.length <= 1 || !this._keyOf) return dir < 0 ? this.prev() : this.next();
    const keys = [];
    this.items.forEach((it) => {
      const k = this._keyOf(it);
      if (keys.indexOf(k) === -1) keys.push(k);
    });
    const cur = keys.indexOf(this._keyOf(this.items[this.currentIndex]));
    const target = keys[(cur + dir + keys.length) % keys.length];
    this.showShareMenu = false;
    this.currentIndex = this.items.findIndex((it) => this._keyOf(it) === target);
    this.processCurrentItem();
    m.redraw();
  }

  prev() {
    if (this.items.length <= 1) return;
    this.showShareMenu = false;
    this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
    this.processCurrentItem();
    m.redraw();
  }

  next() {
    if (this.items.length <= 1) return;
    this.showShareMenu = false;
    this.currentIndex = (this.currentIndex + 1) % this.items.length;
    this.processCurrentItem();
    m.redraw();
  }

  formatDate(dateStr) {
    if (!dateStr) return 'Bilinmiyor';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        const parts = dateStr.split(/[:\s-]/);
        if (parts.length >= 3) {
          return `${parts[2]}.${parts[1]}.${parts[0]}` + (parts[3] ? ` ${parts[3]}:${parts[4] || '00'}:${parts[5] || '00'}` : '');
        }
        return dateStr;
      }
      return d.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  }

  view() {
    const cur = this.items[this.currentIndex] || {};
    const data = cur.data || {};
    const post = cur.post || null;

    const exif = data.exif_data
      ? (typeof data.exif_data === 'string' ? JSON.parse(data.exif_data) : data.exif_data)
      : (cur.exif || {});

    const imageUrl = cur.imageUrl || data.url || data.path || '';
    const camera = `${exif.make || ''} ${exif.model || ''}`.trim() || 'Bilinmiyor';
    let lens = exif.lens || '-';
    if (lens !== '-' && camera.includes(lens)) lens = '-';
    const aperture = exif.aperture || '-';
    const exposure = exif.exposure || '-';
    const iso = exif.iso || '-';
    const focal = exif.focal || '-';
    const formattedDate = this.formatDate(exif.date);
    const gps = (exif.lat && exif.lon) ? { lat: exif.lat, lon: exif.lon } : null;

    let displayTitle = cur.displayTitle || '';
    if (!displayTitle) {
      const details = this.extractPostDetails(cur);
      displayTitle = details.displayTitle;
      cur.displayTitle = displayTitle;
      cur.cleanHtml = details.cleanHtml;
      cur.postNumber = details.postNumber;
    }
    const finalTitle = displayTitle || data.title || data.filename || 'Fotoğraf';
    const cleanHtml = cur.cleanHtml || '';
    const description = data.description || '';
    const postNumber = cur.postNumber || 1;

    const directUrl = window.location.origin + window.location.pathname.replace(/\/\d+$/, '') + '/' + postNumber;

    const hasNav = this.items.length > 1;
    // Aynı mesajın fotoğrafları birlikte: "Mesaj 3/12 · Fotoğraf 2/3" ve mesaj içi küçük resim şeridi
    // Mesaj kimliği: post nesnesi yoksa fotoğrafın bulunduğu mesaj öğesi (PostStream) esas alınır
    this._hostIds = this._hostIds || new Map();
    const keyOf = (it) => {
      const p = it && it.post;
      if (p) return 'p' + String(typeof p.id === 'function' ? p.id() : p.id);
      const el = it && it.containerEl;
      const host = el && el.closest ? el.closest('.PostStream-item') || el.closest('.Post') || el.closest('[data-post-id]') : null;
      if (host) {
        if (!this._hostIds.has(host)) this._hostIds.set(host, 'h' + this._hostIds.size);
        return this._hostIds.get(host);
      }
      return '#' + this.items.indexOf(it);
    };
    this._keyOf = keyOf;
    const keys = [];
    this.items.forEach((it) => {
      const k = keyOf(it);
      if (keys.indexOf(k) === -1) keys.push(k);
    });
    const curKey = keyOf(cur);
    const sameIdx = this.items.map((it, i) => (keyOf(it) === curKey ? i : -1)).filter((i) => i !== -1);
    const posInPost = sameIdx.indexOf(this.currentIndex) + 1;

    return (
      <div
        className="SpottersGallery-Lightbox"
        onclick={(e) => {
          if (
            e.target.classList.contains('SpottersGallery-Lightbox') ||
            e.target.classList.contains('SpottersGallery-Lightbox-Wrapper') ||
            e.target.classList.contains('SpottersGallery-Lightbox-ImageArea')
          ) {
            app.modal.close();
          }
        }}
      >
        {/* KAPAT BUTONU */}
        <button
          type="button"
          className="SpottersGallery-CloseBtn"
          onclick={() => app.modal.close()}
          title="Kapat (ESC)"
        >
          <i className="fas fa-times"></i>
        </button>

        {/* SAYAÇ ROZETİ */}
        {hasNav && (
          <div className="SpottersGallery-CounterBadge">
            {sameIdx.length > 1
              ? `Mesaj ${keys.indexOf(curKey) + 1}/${keys.length} · Fotoğraf ${posInPost}/${sameIdx.length}`
              : keys.length < this.items.length
              ? `Mesaj ${keys.indexOf(curKey) + 1}/${keys.length}`
              : `${this.currentIndex + 1} / ${this.items.length}`}
          </div>
        )}

        {/* SOL VE SAĞ GEZİNME OKLARI */}
        {hasNav && (
          <button
            type="button"
            className="SpottersGallery-NavBtn Prev"
            onclick={(e) => {
              e.stopPropagation();
              this.goPost(-1);
            }}
            title="Önceki Mesaj / Fotoğraf (Sol Ok)"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
        )}

        {hasNav && (
          <button
            type="button"
            className="SpottersGallery-NavBtn Next"
            onclick={(e) => {
              e.stopPropagation();
              this.goPost(1);
            }}
            title="Sonraki Mesaj / Fotoğraf (Sağ Ok)"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        )}

        {sameIdx.length > 1 ? (
          <div className="SpottersGallery-Filmstrip" onclick={(e) => e.stopPropagation()}>
            {sameIdx.map((i) => (
              <div
                className={'SpottersGallery-Thumb' + (i === this.currentIndex ? ' active' : '')}
                onclick={() => {
                  this.showShareMenu = false;
                  this.currentIndex = i;
                  this.processCurrentItem();
                  m.redraw();
                }}
              >
                <img src={this.placeholderUrl(this.items[i])} alt="thumbnail" loading="lazy" />
              </div>
            ))}
          </div>
        ) : null}

        <div className="SpottersGallery-Lightbox-Wrapper" onclick={() => app.modal.close()}>
          <div className="SpottersGallery-Lightbox-Body PanelOpen" onclick={(e) => e.stopPropagation()}>
            
            {/* SOL: FOTOĞRAF ALANI */}
            <div className="SpottersGallery-Lightbox-ImageArea">
              <div className="SpottersGallery-ImageContainer">
                
                {/* ALT EYLEM BUTONLARI (Floating Actions) */}
                <div className="SpottersGallery-FloatingActions" onclick={(e) => e.stopPropagation()}>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className={`SpottersGallery-FloatBtn ${this.showShareMenu ? 'active' : ''}`}
                      data-tooltip="Paylaş"
                      onclick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.showShareMenu = !this.showShareMenu;
                        m.redraw();
                      }}
                    >
                      <i className="fas fa-share-alt"></i>
                    </button>

                    {/* SOSYAL MEDYA PAYLAŞIM POPOVER MENÜSÜ */}
                    {this.showShareMenu && (
                      <div className="SpottersGallery-SharePopover" onclick={(e) => e.stopPropagation()}>
                        <div className="SharePopover-Header">
                          <span>Paylaş</span>
                          <button
                            type="button"
                            className="SharePopover-Close"
                            onclick={() => { this.showShareMenu = false; m.redraw(); }}
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                        <div className="SharePopover-Grid">
                          <a
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(finalTitle + '\n' + directUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ShareItem whatsapp"
                            title="WhatsApp ile Paylaş"
                          >
                            <i className="fab fa-whatsapp"></i>
                            <span>WhatsApp</span>
                          </a>
                          <a
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(finalTitle)}&url=${encodeURIComponent(directUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ShareItem x-twitter"
                            title="X (Twitter) ile Paylaş"
                          >
                            <i className="fab fa-x-twitter"></i>
                            <span>X</span>
                          </a>
                          <a
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(directUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ShareItem facebook"
                            title="Facebook'ta Paylaş"
                          >
                            <i className="fab fa-facebook-f"></i>
                            <span>Facebook</span>
                          </a>
                          <a
                            href={`https://t.me/share/url?url=${encodeURIComponent(directUrl)}&text=${encodeURIComponent(finalTitle)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ShareItem telegram"
                            title="Telegram'da Paylaş"
                          >
                            <i className="fab fa-telegram-plane"></i>
                            <span>Telegram</span>
                          </a>
                          <button
                            type="button"
                            className="ShareItem instagram"
                            title="Instagram için Kopyala"
                            onclick={() => {
                              this.copyTextToClipboard(directUrl, 'Bağlantı kopyalandı! Instagram hikaye veya mesajınızda paylaşabilirsiniz.');
                              this.showShareMenu = false;
                            }}
                          >
                            <i className="fab fa-instagram"></i>
                            <span>Instagram</span>
                          </button>
                          <button
                            type="button"
                            className="ShareItem tiktok"
                            title="TikTok için Kopyala"
                            onclick={() => {
                              this.copyTextToClipboard(directUrl, 'Bağlantı kopyalandı! TikTok\'ta paylaşabilirsiniz.');
                              this.showShareMenu = false;
                            }}
                          >
                            <i className="fab fa-tiktok"></i>
                            <span>TikTok</span>
                          </button>
                        </div>
                        <div className="SharePopover-CopySection">
                          <input
                            type="text"
                            readOnly
                            value={directUrl}
                            className="ShareUrlInput"
                            onclick={(e) => e.target.select()}
                          />
                          <button
                            type="button"
                            className="ShareCopyBtn"
                            title="Bağlantıyı Kopyala"
                            onclick={() => {
                              this.copyTextToClipboard(directUrl, 'Bağlantı panoya kopyalandı!');
                              this.showShareMenu = false;
                            }}
                          >
                            <i className="fas fa-copy"></i>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {cur && (cur.photoId || (cur.data && cur.data.id)) ? (
                    <DownloadChoice
                      imageId={cur.photoId || cur.data.id}
                      className="SpottersGallery-FloatBtn"
                      tooltip="İndir"
                      tooltipAttr="data-tooltip"
                      menuPlacement="up"
                    />
                  ) : (
                    <button
                      type="button"
                      className="SpottersGallery-FloatBtn"
                      data-tooltip="İndir"
                      onclick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.downloadPhoto(cur);
                      }}
                    >
                      <i className="fas fa-download"></i>
                    </button>
                  )}

                  {this.hasHq(cur) && (
                    <button
                      type="button"
                      className={'SpottersGallery-FloatBtn SpottersGallery-HqBtn' + (cur.hq ? ' is-active' : '')}
                      data-tooltip={cur.hq ? 'Standart kaliteye dön' : 'Yüksek Kalite (tam boyut)'}
                      onclick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        cur.hq = !cur.hq;
                        m.redraw();
                      }}
                    >
                      <span>HQ</span>
                    </button>
                  )}

                  <a
                    href={data.original_url || data.original_path || imageUrl}
                    target="_blank"
                    className="SpottersGallery-FloatBtn"
                    data-tooltip="Orijinal Boyut"
                  >
                    <i className="fas fa-expand-arrows-alt"></i>
                  </a>
                </div>

                {(() => {
                  // Önce küçük görsel anında görünür; büyük görsel tamamen inince
                  // üstünde yumuşakça belirir (yarım yarım yüklenme görüntüsü olmaz)
                  const full = this.displayUrl(cur) || imageUrl;
                  const standard = this.displayUrl(Object.assign({}, cur, { hq: false }));
                  const ph = cur.hq && this.loadedUrls.has(standard) ? standard : this.placeholderUrl(cur);
                  const ready = this.loadedUrls.has(full);
                  // Anahtarlı öğe kendi dizisinde: anahtarsız kardeşlerle karışırsa Mithril hata verir
                  return [
                    <div className={'SpottersGallery-ImageStack' + (ready ? ' is-ready' : '')} key={'img-' + (cur.photoId || this.currentIndex) + (cur.hq ? '-hq' : '')}>
                      {ph && ph !== full ? <img className="SpottersGallery-ImagePlaceholder" src={ph} alt="" aria-hidden="true" /> : null}
                      <img
                        className="SpottersGallery-ImageFull"
                        src={full}
                        alt={finalTitle}
                        decoding="async"
                        fetchpriority="high"
                        onload={() => {
                          this.loadedUrls.add(full);
                          this.preloadNeighbours();
                          m.redraw();
                        }}
                      />
                      {!ready ? <span className="SpottersGallery-ImageSpinner" aria-hidden="true"></span> : null}
                    </div>,
                  ];
                })()}
                {sameIdx.length > 1 ? (
                  <button className="SpottersGallery-InnerNav prev" onclick={(e) => { e.stopPropagation(); this.goInPost(sameIdx, -1); }} title="Bu mesajdaki önceki fotoğraf">
                    <i className="fas fa-angle-left"></i>
                  </button>
                ) : null}
                {sameIdx.length > 1 ? (
                  <button className="SpottersGallery-InnerNav next" onclick={(e) => { e.stopPropagation(); this.goInPost(sameIdx, 1); }} title="Bu mesajdaki sonraki fotoğraf">
                    <i className="fas fa-angle-right"></i>
                  </button>
                ) : null}
              </div>
            </div>

            {/* SAĞ: BİLGİ VE EXIF PANELİ */}
            <div className="SpottersGallery-InfoPanel is-open">
              <div className="SpottersGallery-InfoContent">
                
                {/* 1. BAŞLIK KARTI */}
                <div className="SpottersGallery-SideCard TitleCard">
                  <h2>{finalTitle}</h2>
                </div>

                {/* 2. MESAJ KÜNYESİ / AÇIKLAMA KARTI */}
                {(cleanHtml || description) && (
                  <div className="SpottersGallery-SideCard DescCard">
                    <div className="SpottersGallery-DescHeader">
                      <h4>{cleanHtml ? 'MESAJ KÜNYESİ' : 'FOTOĞRAF AÇIKLAMASI'}</h4>
                    </div>
                    <div className="SpottersGallery-DescContent" data-post-id={post ? String(typeof post.id === 'function' ? post.id() : post.id) : undefined}>
                      {cleanHtml ? (
                        m.trust(cleanHtml)
                      ) : (
                        <p>{description}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. EXIF KARTI */}
                <div className="SpottersGallery-SideCard ExifCard">
                  <div className="ExifCard-Header">
                    <h4>FOTOĞRAF BİLGİLERİ (EXIF)</h4>
                  </div>
                  <div className="ExifCard-Body">
                    <div className="Exif-Row">
                      <span className="label">Kamera</span>
                      <span className="value">{camera}</span>
                    </div>
                    <div className="Exif-Row">
                      <span className="label">Lens</span>
                      <span className="value">{lens}</span>
                    </div>
                    <div className="Exif-StatsGrid">
                      <div className="Exif-Row">
                        <span className="label">Enstantane</span>
                        <span className="value">{exposure}</span>
                      </div>
                      <div className="Exif-Row">
                        <span className="label">Diyafram</span>
                        <span className="value">{aperture}</span>
                      </div>
                      <div className="Exif-Row">
                        <span className="label">ISO</span>
                        <span className="value">{iso}</span>
                      </div>
                      <div className="Exif-Row">
                        <span className="label">Odak Uzaklığı</span>
                        <span className="value">{focal}</span>
                      </div>
                    </div>
                  </div>
                  <div className="Exif-Footer">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="label">Çekim Tarihi</span>
                        <span className="value">{formattedDate}</span>
                      </div>
                      {gps && gps.lat && gps.lon && (
                        <a
                          href={`https://www.google.com/maps?q=${gps.lat},${gps.lon}`}
                          target="_blank"
                          className="Button Button--primary"
                          style={{
                            fontSize: '12px',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            height: 'fit-content'
                          }}
                        >
                          <i className="fas fa-map-marker-alt"></i> Haritada Gör
                        </a>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }
}
