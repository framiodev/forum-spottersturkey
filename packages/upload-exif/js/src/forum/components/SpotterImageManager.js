import Component from 'flarum/common/Component';
import CommentPost from 'flarum/forum/components/CommentPost';
import { extend } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import SpotterCarousel from './SpotterCarousel';
import CustomizePostModal from './CustomizePostModal';
import ExifLightboxModal from './ExifLightboxModal';
import DownloadChoice from './DownloadChoice';

// Global audio & playback state across all images (Instagram style)
let globalSpotterAudio = null;
let globalActiveTrackCard = null;
let globalIsMuted = false;
let globalIntersectionObserver = null;
const observedCardElements = new Map(); // DOM element -> SpotterImageCard

// Global card instance registry — key: photoId (string), value: SpotterImageCard instance
// Used for instant updates (no page reload) after customize modal saves
const cardRegistry = new Map();

function getGlobalObserver() {
  if (!globalIntersectionObserver && typeof IntersectionObserver !== 'undefined') {
    globalIntersectionObserver = new IntersectionObserver((entries) => {
      let bestEntry = null;
      let highestRatio = 0;

      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > highestRatio) {
          highestRatio = entry.intersectionRatio;
          bestEntry = entry;
        }
      });

      if (bestEntry && highestRatio >= 0.5) {
        const card = observedCardElements.get(bestEntry.target);
        if (card && card.getMusicData() && !card.isPlayingMusic) {
          card.playMusic(true);
        }
      } else {
        entries.forEach(entry => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.25) {
            const card = observedCardElements.get(entry.target);
            if (card && card.isPlayingMusic && globalActiveTrackCard === card) {
              card.stopMusic();
            }
          }
        });
      }
    }, {
      threshold: [0.25, 0.5, 0.75]
    });
  }
  return globalIntersectionObserver;
}

class SpotterImageCard extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.id = this.attrs.photoId;
    this.data = null;
    this.showExif = Boolean(this.attrs.initialExifOpen);
    this.isPlayingMusic = false;
    this.containerEl = this.attrs.containerEl;
    this.fetchExifData();
  }

  fetchExifData() {
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio-media/image/' + this.id,
      // Kayıt bulunamazsa Flarum'un genel hata uyarısı gösterilmesin;
      // kart EXIF verisi olmadan görseli göstermeye devam eder.
      errorHandler: () => {}
    }).then(response => {
      this.data = response;
      cardRegistry.set(String(this.id), this);
      // Eğer bu kart mount olduğunda zaten aynı müzik global olarak çalıyorsa, çalma durumunu koru
      const currentMusic = this.getMusicData();
      if (globalSpotterAudio && !globalSpotterAudio.paused && currentMusic && globalActiveTrackCard) {
        const activeMusic = globalActiveTrackCard.getMusicData();
        if (activeMusic && (activeMusic.preview_url === currentMusic.preview_url || activeMusic.id === currentMusic.id)) {
          this.isPlayingMusic = true;
          globalActiveTrackCard = this;
        }
      }
      m.redraw();
    }).catch(() => {
      this.data = null;
      m.redraw();
    });
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    cardRegistry.set(String(this.id), this);
    this.setupIntersectionObserver(vnode.dom);
  }

  onupdate(vnode) {
    super.onupdate(vnode);
    cardRegistry.set(String(this.id), this);
    this.setupIntersectionObserver(vnode.dom);
  }

  mountInfoButton() {
    // Carousel içindeki kart: düğme carousel alanına (ilk görselin gizlenmiş 1px kutusuna değil)
    const carouselArea = this.carouselEl ? this.carouselEl.querySelector('.SpotterCarousel-Container') : null;
    const wrapper = this.attrs.imageWrapper || carouselArea
      || (this.containerEl ? this.containerEl.querySelector('.SpotterCard-image-wrapper') : null);
    if (!wrapper) return;
    wrapper.style.position = 'relative';
    
    let btn = wrapper.querySelector('.SpotterCard-InfoToggle');
    const exifTheme = app.forum.attribute('framio-upload-exif.exif_theme') || 'lightbox_modal';
    
    // Yalnızca Lightbox modunda görsel üzerinde (i) butonu ve tıklama olayı eklenir. Klasik modda gösterilmez.
    if (exifTheme !== 'lightbox_modal') {
      if (btn) btn.remove();
      wrapper.style.cursor = 'default';
      wrapper.onclick = null;
      return;
    }

    wrapper.style.cursor = 'pointer';
    wrapper.onclick = (e) => {
      // Carousel okları ve noktaları EXIF'i açmaz
      if (e.target.closest('button, a, .SpotterCarousel-Arrow, .SpotterCarousel-Dot')) return;
      this.toggleExif(e);
    };

    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'SpotterCard-InfoToggle';
      btn.title = 'Fotoğraf Bilgileri (EXIF & Künye)';
      btn.innerHTML = '<i class="fas fa-info"></i>';
      wrapper.appendChild(btn);
    }
    // Carousel'de fotoğraf değişince kart yenisiyle değişir: düğme her zaman güncel karta bağlanır
    btn.onclick = (e) => this.toggleExif(e);
    btn.classList.toggle('active', !!this.showExif);
  }

  updateContainerElement(domEl) {
    if (!domEl) return;
    this.carouselEl = domEl.closest('.SpotterCarousel-Wrapper');
    this.containerEl = domEl.closest('.framio-image-container') || domEl.closest('.SpotterCard') || this.carouselEl;
  }

  getAestheticTitleFromPost(post, fallbackTitle) {
    let cleanFallback = fallbackTitle;
    try {
      const txt = document.createElement('textarea');
      txt.innerHTML = fallbackTitle;
      cleanFallback = txt.value;
    } catch(e){}

    if (!post) return cleanFallback;
    
    let extractedTitle = null;
    let contentHtml = (typeof post.contentHtml === 'function' ? post.contentHtml() : post.contentHtml) || '';

    if (contentHtml) {
      const temp = document.createElement('div');
      temp.innerHTML = contentHtml.replace(/<img[^>]*>/gi, '').replace(/<figure[^>]*>.*?<\/figure>/gi, '');
      
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
        }
      }
    }

    if (extractedTitle) return extractedTitle;

    if (typeof post.discussion === 'function' && post.discussion()) {
      const discussion = post.discussion();
      if (discussion && discussion.title()) {
        const dTitle = discussion.title();
        if (!dTitle.toLowerCase().includes('fotoğraf')) {
          return dTitle;
        }
      }
    }

    return cleanFallback;
  }

  toggleExif(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const theme = app.forum.attribute('framio-upload-exif.exif_theme') || 'lightbox_modal';

    // Kullanıcı Medyası Lightbox Modu (Tüm tartışmadaki görseller arasında oklarla gezinme)
    if (theme === 'lightbox_modal') {
      const allContainers = Array.from(document.querySelectorAll('.framio-image-container[data-id], .ulasimarsiv-image-container[data-id], .SpotterCard[data-id]'));
      const seenIds = new Set();
      const items = [];

      allContainers.forEach(container => {
        const pId = container.getAttribute('data-id');
        if (!pId || seenIds.has(String(pId))) return;
        seenIds.add(String(pId));

        let pPost = null;
        const postEl = container.closest('.Post');
        if (postEl) {
          const postId = postEl.getAttribute('data-id');
          if (postId && app.store) {
            pPost = app.store.getById('posts', postId);
          }
        }

        const registeredCard = cardRegistry.get(String(pId));
        const itemData = registeredCard ? registeredCard.data : (String(pId) === String(this.id) ? this.data : null);
        const imgEl = container.querySelector('img');
        const fallbackUrl = imgEl ? imgEl.src : '';

        items.push({
          photoId: pId,
          imageUrl: itemData ? (itemData.url || itemData.path) : fallbackUrl,
          data: itemData,
          post: pPost,
          containerEl: container
        });
      });

      let currentIndex = items.findIndex(item => String(item.photoId) === String(this.id));
      if (currentIndex === -1) {
        currentIndex = 0;
        items.unshift({
          photoId: this.id,
          imageUrl: this.data ? (this.data.url || this.data.path) : '',
          data: this.data,
          post: this.attrs.post,
          containerEl: this.containerEl
        });
      }

      app.modal.show(ExifLightboxModal, {
        items: items,
        currentIndex: currentIndex,
        photoId: this.id,
        imageUrl: this.data ? (this.data.url || this.data.path) : '',
        data: this.data,
        post: this.attrs.post
      });
      return;
    }

    this.showExif = !this.showExif;
    if (this.attrs.onToggleExif) {
      this.attrs.onToggleExif(this.showExif);
    }
    m.redraw();
  }

  setupIntersectionObserver(domEl) {
    if (!domEl) return;
    const observer = getGlobalObserver();
    if (!observer) return;

    // Önceki kayıtlı elementi temizle
    for (const [el, card] of observedCardElements.entries()) {
      if (card === this && el !== domEl) {
        observer.unobserve(el);
        observedCardElements.delete(el);
      }
    }

    observedCardElements.set(domEl, this);
    observer.observe(domEl);
  }

  onremove(vnode) {
    super.onremove(vnode);
    cardRegistry.delete(String(this.id));
    if (vnode && vnode.dom) {
      const observer = getGlobalObserver();
      if (observer) {
        observer.unobserve(vnode.dom);
      }
      observedCardElements.delete(vnode.dom);
    }
    if (globalActiveTrackCard === this) {
      this.stopMusic();
    }
  }

  getMusicData() {
    if (!this.data || !this.data.music_data) return null;
    return typeof this.data.music_data === 'string'
      ? JSON.parse(this.data.music_data)
      : this.data.music_data;
  }

  openCustomizeModal(e, imageIds) {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    const exif = JSON.parse(this.data && this.data.exif_data ? (typeof this.data.exif_data === 'string' ? this.data.exif_data : JSON.stringify(this.data.exif_data)) : '{}');
    const initialGps = (exif.lat && exif.lon) ? { lat: exif.lat, lon: exif.lon } : null;
    const ids = (imageIds && imageIds.length > 0) ? imageIds : [this.id];

    app.modal.show(CustomizePostModal, {
      music: this.getMusicData(),
      gps: initialGps,
      initialGps: initialGps,
      onconfirm: (customData) => {
        app.request({
          method: 'PATCH',
          url: app.forum.attribute('apiUrl') + '/framio-media/image/' + ids.join(',') + '/custom-data',
          body: { custom_music: customData.music, custom_gps: customData.gps }
        }).then(res => {
          ids.forEach(id => {
            const card = cardRegistry.get(String(id));
            if (card) {
              card.data = {
                ...card.data,
                music_data: res.music_data,
                exif_data: typeof res.exif_data === 'string' ? res.exif_data : JSON.stringify(res.exif_data)
              };
            }
          });
          if (globalActiveTrackCard && ids.includes(String(globalActiveTrackCard.id))) {
            const oldMusic = globalActiveTrackCard.getMusicData() || {};
            const newMusic = res.music_data
              ? (typeof res.music_data === 'string' ? JSON.parse(res.music_data) : res.music_data)
              : null;
            if (!newMusic || (newMusic.id !== oldMusic.id)) globalActiveTrackCard.stopMusic();
          }
          app.alerts.show({ type: 'success' }, 'Gönderi özelleştirmeleri güncellendi.');
          m.redraw();
        }).catch(err => {
          console.error(err);
          app.alerts.show({ type: 'error' }, 'Güncelleme sırasında bir hata oluştu.');
        });
      }
    });
  }

  playMusic(fromObserver = false) {
    const music = this.getMusicData();
    if (!music || !music.preview_url) return;

    if (globalSpotterAudio) {
      if (globalActiveTrackCard && globalActiveTrackCard !== this) {
        globalActiveTrackCard.isPlayingMusic = false;
      }
      globalSpotterAudio.pause();
      globalSpotterAudio = null;
    }

    globalSpotterAudio = new Audio(music.preview_url);
    globalSpotterAudio.volume = 0.5;
    globalSpotterAudio.muted = globalIsMuted;
    globalActiveTrackCard = this;
    this.isPlayingMusic = true;

    globalSpotterAudio.play().catch(err => {
      // Autoplay engeli
      this.isPlayingMusic = false;
      m.redraw();
    });

    globalSpotterAudio.onended = () => {
      this.isPlayingMusic = false;
      globalActiveTrackCard = null;
      m.redraw();
    };

    m.redraw();
  }

  stopMusic() {
    if (globalSpotterAudio && globalActiveTrackCard === this) {
      globalSpotterAudio.pause();
      globalSpotterAudio = null;
      globalActiveTrackCard = null;
    }
    this.isPlayingMusic = false;
    m.redraw();
  }

  toggleMusic(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (this.isPlayingMusic) {
      this.stopMusic();
    } else {
      this.playMusic(false);
    }
  }

  formatDate(dateStr) {
    if (!dateStr) return 'Belirtilmemiş';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        const parts = dateStr.split(/[:\s-]/);
        if (parts.length >= 3) {
          return `${parts[2]}.${parts[1]}.${parts[0]}` + (parts[3] ? ` ${parts[3]}:${parts[4] || '00'}` : '');
        }
        return dateStr;
      }
      return d.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  }

  view() {
    if (!this.data) {
      return <div className="SpotterCard-loading" style={{ display: 'none' }}></div>;
    }

    const exif = this.data.exif_data
      ? (typeof this.data.exif_data === 'string' ? JSON.parse(this.data.exif_data) : this.data.exif_data)
      : {};

    const camera = `${exif.make || ''} ${exif.model || ''}`.trim() || 'Belirtilmemiş';
    let lens = exif.lens || 'Belirtilmemiş';
    if (lens !== 'Belirtilmemiş' && camera.includes(lens)) lens = '-';

    const aperture = exif.aperture || '-';
    const exposure = exif.exposure || '-';
    const iso = exif.iso || '-';
    const focal = exif.focal || '-';
    const formattedDate = this.formatDate(exif.date);

    const currentUser = app.session.user;
    const isOwner = currentUser && parseInt(currentUser.id()) === parseInt(this.data.user_id);
    const isAdmin = currentUser && currentUser.isAdmin();
    const canCustomize = isOwner || isAdmin;
    const showPublicly = app.forum.attribute('framio-upload-exif.show_exif_publicly');
    const canSeeExif = (showPublicly === '1' || showPublicly === true || isAdmin);

    const music = this.getMusicData();
    const currentTheme = app.forum.attribute('framio-upload-exif.exif_theme') || 'lightbox_modal';

    return (
      <div className="SpotterCard-container" oncreate={(vnode) => { this.updateContainerElement(vnode.dom); this.mountInfoButton(); }} onupdate={(vnode) => { this.updateContainerElement(vnode.dom); this.mountInfoButton(); }}>
        {/* TOP CONTROLS: Müzik Rozeti + Orijinal / Yüksek Kalite */}
        <div className="SpotterCard-topControls">
          {/* Müzik Rozeti */}
          {music && (
            <div
              className={`SpotterCard-musicBadge ${this.isPlayingMusic ? 'is-playing' : ''}`}
              onclick={(e) => this.toggleMusic(e)}
              title={this.isPlayingMusic ? 'Müziği Durdur' : 'Müziği Çal'}
            >
              <div className="music-icon-wrapper">
                <i className={`fas ${this.isPlayingMusic ? 'fa-compact-disc fa-spin' : 'fa-music'}`}></i>
              </div>
              <div className="music-info">
                <span className="music-title">{music.title}</span>
                {music.artist && <span className="music-artist">{music.artist}</span>}
              </div>
              <div className="music-status-icon">
                <i className={`fas ${this.isPlayingMusic ? 'fa-volume-up' : 'fa-play'}`}></i>
              </div>
            </div>
          )}

          {/* Sağ Üst Butonlar (Orijinal & Yüksek Kalite) */}
          <div className="SpotterCard-topRightControls">
            {this.data.original_path && (
              <a
                href={this.data.original_path}
                target="_blank"
                className="SpotterCard-actionBtn SpotterCard-originalBtn"
                title="Orijinal Çözünürlükte Görüntüle"
                onclick={(e) => e.stopPropagation()}
              >
                <i className="fas fa-expand"></i>
                <span>Orijinal</span>
              </a>
            )}

            <a
              href={this.data.path || this.data.url}
              target="_blank"
              className="SpotterCard-actionBtn SpotterCard-hqBtn"
              title="Yüksek Kalitede Aç"
              onclick={(e) => e.stopPropagation()}
            >
              <i className="fas fa-search-plus"></i>
              <span>Yüksek Kalite</span>
            </a>

            {/* Klasik kart modunda indirme: filigranlı görsel JPG'ye çevrilip EXIF ve künyeyle iner */}
            {currentTheme === 'classic' && this.data.id && (
              <DownloadChoice imageId={this.data.id} className="SpotterCard-actionBtn SpotterCard-downloadBtn" tooltip="Fotoğrafı İndir" />
            )}

            {/* Slide sayacı */}
            {this.attrs.totalCount && this.attrs.totalCount > 1 ? (
              <div className="SpotterCard-slideCounter">
                {(this.attrs.currentIndex || 0) + 1} / {this.attrs.totalCount}
              </div>
            ) : null}
          </div>
        </div>

        {/* KLASİK AKORDİYON EXIF PANELİ (Spotters Turkey Tasarımı - Fotoğraf Altında) */}
        {canSeeExif && currentTheme === 'classic' && (
          <div className="SpotterCard-exif-wrapper">
            <div
              className="SpotterCard-toggle"
              onclick={() => {
                this.showExif = !this.showExif;
                if (this.attrs.onToggleExif) {
                  this.attrs.onToggleExif(this.showExif);
                }
                m.redraw();
              }}
            >
              <span>FOTOĞRAF BİLGİLERİ (EXIF)</span>
              <i className={`fas fa-chevron-${this.showExif ? 'up' : 'down'}`}></i>
            </div>

            {this.showExif && (
              <div className="SpotterCard-exif fade-in">
                <div className="SpotterCard-grid">
                  {/* Sol sütun: Ekipman */}
                  <div className="sc-left-col">
                    <div className="gear-group">
                      <div className="gear-label">Makine</div>
                      <div className="gear-name">{camera}</div>
                    </div>
                    {lens && lens !== '-' && (
                      <div className="gear-group">
                        <div className="gear-label">Lens</div>
                        <div className="lens-name">{lens}</div>
                      </div>
                    )}
                  </div>

                  {/* Sağ sütun: Ayarlar */}
                  <div className="sc-right-col">
                    <div className="stat-box"><span>Diyafram</span><b>{aperture}</b></div>
                    <div className="stat-box"><span>Enstantane</span><b>{exposure}</b></div>
                    <div className="stat-box"><span>ISO</span><b>{iso}</b></div>
                    <div className="stat-box"><span>Odak</span><b>{focal}</b></div>
                  </div>

                  {/* Footer */}
                  <div className="sc-footer">
                    <div className="date-box">
                      <span>Çekim Tarihi</span>
                      <b>{formattedDate}</b>
                    </div>
                    {exif.lat && exif.lon ? (
                      <a
                        href={`https://www.google.com/maps?q=${exif.lat},${exif.lon}`}
                        target="_blank"
                        className="map-btn"
                        onclick={(e) => e.stopPropagation()}
                      >
                        Haritada Gör
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}

export default {
  init: () => {
    const mountSpotterImages = function() {
      try {
        const postBody = this.element.querySelector('.Post-body');
        if (!postBody) return;

        const containers = postBody.querySelectorAll('.framio-image-container');
        if (containers.length === 0) return;

        const currentTheme = app.forum.attribute('framio-upload-exif.exif_theme') || 'slide_over';
        containers.forEach(el => {
          el.classList.add('theme-' + currentTheme);
        });

        const adminEnabled = app.forum.attribute('framio-upload-exif.enable_carousel_mode') === '1' || app.forum.attribute('framio-upload-exif.enable_carousel_mode') === true;
        const userPref = app.session.user ? app.session.user.preferences().framio_carousel_enabled : true;
        const userEnabled = userPref !== false;
        const carouselEnabled = adminEnabled && userEnabled;
        const post = this.attrs ? this.attrs.post : null;

        if (carouselEnabled && containers.length > 1) {
          const imagesList = Array.from(containers).map(el => ({
            id: el.getAttribute('data-id'),
            originalElement: el
          }));

          // Birden çok açıklama: her görselin ardından (bir sonraki görsele
          // kadar) gelen künye bloğu o görsele aittir. Kaydırıcı yalnızca
          // açık fotoğrafın künyesini gösterir.
          const kunyeOf = (el) => {
            for (let n = el.nextElementSibling; n && !n.classList.contains('framio-image-container'); n = n.nextElementSibling) {
              if (n.matches('.framio-kunye-card, ul') || n.querySelector('.framio-kunye-card, ul')) return n;
            }
            return null;
          };
          const kunyes = Array.from(containers).map(kunyeOf);
          const distinct = new Set(kunyes.filter(Boolean).map(n => n.textContent.replace(/\s+/g, ' ').trim()));
          const perPhotoKunye = kunyes.filter(Boolean).length > 1 && distinct.size > 1;

          containers.forEach((el, index) => {
            el.classList.add('SpotterCard');
            const exifPlaceholder = el.querySelector('.spotter-exif-placeholder');
            const imageWrapper = el.querySelector('.SpotterCard-image-wrapper');

            if (index === 0) {
              if (imageWrapper) {
                // SEO Dostu: display: none yerine arama motorlarının görebileceği ancak sayfada alan kaplamayan stil
                imageWrapper.style.cssText = 'position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; border: 0 !important; opacity: 0 !important; pointer-events: none !important;';
              }

              if (exifPlaceholder && !exifPlaceholder.hasChildNodes()) {
                exifPlaceholder.style.margin = '0';
                exifPlaceholder.style.padding = '0';

                const dotsContainer = document.createElement('div');
                dotsContainer.className = 'SpotterCarousel-Dots-Container';
                el.parentNode.insertBefore(dotsContainer, el.nextSibling);

                m.mount(exifPlaceholder, {
                  view: () => m(SpotterCarousel, { images: imagesList, SpotterImageCard: SpotterImageCard, dotsContainer: dotsContainer, post: post, kunyes: perPhotoKunye ? kunyes : null })
                });
              }
            } else {
              // SEO Dostu Gizleme: display: none görsellerin Google Görseller tarafından tamamen yok sayılmasına neden olur.
              // Bunun yerine erişilebilir/gizli stil vererek botların görselleri ve alt etiketlerini okumasını sağlıyoruz.
              el.style.cssText = 'position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; border: 0 !important; opacity: 0 !important; pointer-events: none !important;';
            }
          });
        } else {
          containers.forEach(el => {
            const id = el.getAttribute('data-id');
            const exifPlaceholder = el.querySelector('.spotter-exif-placeholder');
            el.classList.add('SpotterCard');
            if (exifPlaceholder && !exifPlaceholder.hasChildNodes()) {
              m.mount(exifPlaceholder, { view: () => m(SpotterImageCard, { photoId: id, post: post }) });
            }
          });
        }

        const contentImages = postBody.querySelectorAll('img');
        contentImages.forEach(img => {
          if (!img.closest('.framio-image-container') &&
            !img.classList.contains('emoji') &&
            !img.classList.contains('Avatar')) {
            img.classList.add('spotter-old-image');
            img.style.cssText = "display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; border: none !important;";
            if (img.nextSibling && img.nextSibling.tagName === 'BR') img.nextSibling.style.display = 'none';
            if (img.previousSibling && img.previousSibling.tagName === 'BR') img.previousSibling.style.display = 'none';
          }
        });

      } catch (err) {
        console.error("Spotter mount error:", err);
      }
    };

    extend(CommentPost.prototype, 'oncreate', mountSpotterImages);
    extend(CommentPost.prototype, 'onupdate', mountSpotterImages);
  },
  SpotterImageCard,
  cardRegistry
};
