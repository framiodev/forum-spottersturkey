import UserPage from 'flarum/forum/components/UserPage';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
const icon = (iconName, attrs = {}) => { attrs.className = (attrs.className || "") + " icon " + iconName; return m("i", attrs); };
import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';

// --- GÖMÜLÜ STİLLER ---
const GALLERY_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');

body.FramioGallery-NoScroll { overflow: hidden; }
.FramioGallery-Page { padding: 20px 0; }

/* HEADER */
.FramioGallery-Header {
    position: relative; 
    display: flex; justify-content: center; align-items: center;
    margin-bottom: 25px; border-bottom: 2px solid var(--primary-color);
    padding-bottom: 10px; min-height: 40px;
}
.FramioGallery-Header h3 { 
    margin: 0; font-family: 'Cairo', sans-serif;
    font-size: 26px; font-weight: 700; color: var(--heading-color); 
    text-transform: capitalize; letter-spacing: normal;
}
.FramioGallery-ViewControls {
    position: absolute; right: 0; top: 50%; transform: translateY(-50%); 
    display: flex; gap: 5px;
}
.FramioGallery-ViewBtn {
    background: var(--control-bg); border: 1px solid transparent; color: var(--muted-color);
    width: 32px; height: 32px; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.2s;
}
.FramioGallery-ViewBtn:hover { color: var(--text-color); background: var(--control-bg-hover); }
.FramioGallery-ViewBtn.active { background: var(--primary-color); color: #fff; }

/* GRID */
.FramioGallery-Grid { display: grid; gap: 2px; }
.FramioGallery-Card { position: relative; border-radius: 1px; overflow: hidden; aspect-ratio: 16 / 10; background: var(--control-bg); cursor: pointer; transform: translateZ(0); box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
.FramioGallery-Card-ImageWrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94); display: block; }
.FramioGallery-Card:hover .FramioGallery-Card-ImageWrap img { transform: scale(1.05); }
.FramioGallery-Card-Overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; opacity: 0; transition: opacity 0.15s ease-out; }
.FramioGallery-Card:hover .FramioGallery-Card-Overlay { opacity: 1; }
.FramioGallery-Actions { display: flex; gap: 10px; }
.FramioGallery-ActionBtn { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.1s; font-size: 16px; }
.FramioGallery-ActionBtn:hover { background: #fff; color: #333; transform: scale(1.1); }
.FramioGallery-ActionBtn.delete:hover { background: #e74c3c; color: white; border-color: #e74c3c; }

/* LIGHTBOX ANA YAPISI */
.FramioGallery-Lightbox { position: fixed; inset: 0; z-index: 1200; background: rgba(0, 0, 0, 0.95); display: flex; flex-direction: column; align-items: center; justify-content: center; animation: sg-fadeIn 0.2s ease-out; font-family: 'Cairo', sans-serif; }
.FramioGallery-Lightbox * { box-sizing: border-box; }
.FramioGallery-CloseBtn { position: absolute; top: 20px; right: 25px; background: none; border: none; color: #fff; font-size: 32px; cursor: pointer; z-index: 1300; opacity: 0.8; transition: opacity 0.2s; line-height: 1; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
.FramioGallery-CloseBtn:hover { opacity: 1; color: #e74c3c; }

/* WRAPPER & NAV */
.FramioGallery-Lightbox-Wrapper { display: flex; align-items: center; justify-content: center; width: 100%; height: calc(100% - 60px); position: relative; pointer-events: none; }
.FramioGallery-Lightbox-Wrapper > * { pointer-events: auto; }

.FramioGallery-Nav { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); font-size: 24px; cursor: pointer; padding: 15px; border-radius: 50%; transition: all 0.2s; position: absolute; top: 50%; transform: translateY(-50%); z-index: 1205; backdrop-filter: blur(4px); }
.FramioGallery-Nav:hover { color: #fff; background: rgba(255,255,255,0.3); }
.FramioGallery-Nav--prev { left: 20px; }
.FramioGallery-Nav--next { right: 20px; }

/* LIGHTBOX BODY (KAPSAYICI) */
.FramioGallery-Lightbox-Body { 
    display: inline-flex; 
    flex-direction: row; 
    width: auto; 
    max-width: 95vw; 
    height: auto; 
    max-height: 85vh; 
    background: transparent; 
    border-radius: 4px; 
    overflow: hidden; 
    transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1); 
    box-shadow: none; 
    align-items: stretch; 
}

/* SOL TARA (GÖRSEL) */
.FramioGallery-Lightbox-ImageArea { 
    flex: 0 0 auto; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    position: relative; 
    background: transparent; 
    min-width: 0; 
}

/* Resim Container */
.FramioGallery-ImageContainer { 
    position: relative; 
    width: fit-content; 
    height: auto; 
    display: block;
    max-width: 100%;
    max-height: 85vh; 
}
.FramioGallery-ImageContainer img { 
    height: auto; 
    width: auto; 
    max-height: 85vh; 
    max-width: 100%; 
    max-width: 1024px; 
    object-fit: contain; 
    display: block; 
    box-shadow: 0 10px 40px rgba(0,0,0,0.5); 
    border-radius: 2px;
}
@media (min-width: 1025px) { .FramioGallery-ImageContainer img { max-width: 1024px; } }

/* Butonlar */
.FramioGallery-InfoToggle { position: absolute; top: 15px; right: 15px; z-index: 1210; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.3); color: #fff; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: all 0.2s; backdrop-filter: blur(4px); }
.FramioGallery-InfoToggle:hover { background: rgba(255,255,255,0.3); transform: scale(1.1); }
.FramioGallery-InfoToggle.active { background: var(--primary-color); border-color: var(--primary-color); }

.FramioGallery-OverlayTitle { position: absolute; top: 0; left: 0; right: 0; padding: 20px 70px 40px 20px; background: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%); color: #fff; font-family: 'Cairo', sans-serif; font-weight: 700; font-size: 18px; z-index: 1200; pointer-events: none; text-shadow: 0 2px 4px rgba(0,0,0,0.5); opacity: 0; transition: opacity 0.3s ease; border-top-left-radius: 2px; border-top-right-radius: 2px; }
.FramioGallery-Lightbox-ImageArea:not(.PanelOpen) .FramioGallery-OverlayTitle { opacity: 1; }

.FramioGallery-FloatingActions { position: absolute; bottom: 15px; right: 15px; z-index: 1220; display: flex; gap: 8px; align-items: center; }
.FramioGallery-FloatBtn { background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: all 0.2s; backdrop-filter: blur(4px); text-decoration: none; position: relative; }
.FramioGallery-FloatBtn:hover { background: rgba(255,255,255,0.2); transform: scale(1.1); color: #fff; border-color: rgba(255,255,255,0.5); }
.FramioGallery-FloatBtn.danger:hover { background: #e74c3c; border-color: #e74c3c; }
.FramioGallery-FloatBtn.primary:hover { background: var(--primary-color); border-color: var(--primary-color); }
.FramioGallery-FloatBtn::after { content: attr(data-tooltip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #000; color: #fff; padding: 5px 8px; border-radius: 4px; font-size: 11px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.2s; margin-bottom: 8px; font-family: 'Cairo', sans-serif; font-weight: 600; }
.FramioGallery-FloatBtn:hover::after { opacity: 1; }

.FramioShare-Popup, .FramioDownload-Popup { position: absolute; bottom: 55px; right: 0; background: var(--control-bg); border-radius: 8px; box-shadow: 0 5px 20px rgba(0,0,0,0.3); padding: 5px; display: flex; flex-direction: column; gap: 2px; width: 180px; z-index: 1230; animation: sg-fadeIn 0.2s ease; }
.FramioShare-Item, .FramioDownload-Item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 6px; color: var(--text-color); font-size: 13px; cursor: pointer; font-family: 'Cairo', sans-serif; text-decoration: none; }
.FramioShare-Item:hover, .FramioDownload-Item:hover { background: var(--control-bg-hover); color: var(--primary-color); }
.FramioShare-Item i { width: 16px; text-align: center; }

.FramioDownload-Popup { width: 220px; }
.FramioDownload-Item { flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px; border-bottom: 1px solid var(--control-bg-hover); }
.FramioDownload-Item:last-child { border-bottom: none; }
.FramioDownload-Item .dl-title { font-weight: 700; display: flex; align-items: center; gap: 8px; width: 100%; color: var(--heading-color); }
.FramioDownload-Item .dl-info { font-size: 11px; opacity: 0.7; margin-left: 24px; font-weight: 400; }
.FramioDownload-Item i { width: 16px; text-align: center; color: var(--primary-color); }

/* Filmstrip */
.FramioGallery-Filmstrip { position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; background: rgba(0, 0, 0, 0.95); border-top: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; gap: 10px; padding: 10px 20px; z-index: 1250; overflow-x: auto; scrollbar-width: thin; scrollbar-color: #555 #000; }
.FramioGallery-Filmstrip::-webkit-scrollbar { height: 6px; }
.FramioGallery-Filmstrip::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
.FramioGallery-Thumb { height: 40px; width: auto; aspect-ratio: 16/9; cursor: pointer; opacity: 0.5; transition: all 0.2s; border: 2px solid transparent; border-radius: 3px; flex-shrink: 0; overflow: hidden; }
.FramioGallery-Thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.FramioGallery-Thumb:hover { opacity: 0.8; transform: scale(1.05); }
.FramioGallery-Thumb.active { opacity: 1; border-color: var(--primary-color); transform: scale(1.1); box-shadow: 0 0 10px rgba(0,0,0,0.5); }

/* Sağ Panel */
.FramioGallery-InfoPanel { background: transparent; color: var(--text-color); display: flex; flex-direction: column; align-items: center; gap: 10px; width: 0; min-width: 0; padding: 0; margin: 0; overflow: hidden; opacity: 0; visibility: hidden; height: 0; align-self: stretch; transition: width 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease, padding 0.3s, visibility 0.3s; border-left: none; flex-shrink: 0; font-family: 'Cairo', sans-serif; }
.FramioGallery-InfoPanel.is-open { width: 400px; height: auto; opacity: 1; visibility: visible; padding: 0 0 0 20px; }

/* İçerik Alanı */
.FramioGallery-InfoContent { width: 100%; height: 100%; display: flex; flex-direction: column; gap: 15px; justify-content: flex-start; overflow-y: auto; overflow-x: hidden; padding-right: 5px; scrollbar-width: thin; scrollbar-color: var(--muted-color) transparent; }
.FramioGallery-InfoContent::-webkit-scrollbar { width: 4px; }
.FramioGallery-InfoContent::-webkit-scrollbar-thumb { background: var(--muted-color); border-radius: 2px; }

/* KARTLAR */
.FramioGallery-SideCard { background: var(--control-bg); border: 1px solid transparent; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.3); overflow: hidden; width: 100%; flex-shrink: 0; }
.FramioGallery-SideCard.TitleCard { padding: 20px; text-align: left; background: var(--control-bg); flex: 0 0 auto; }
.FramioGallery-SideCard.TitleCard h2 { margin: 0; font-size: 18px; font-weight: 700; color: var(--heading-color); line-height: 1.3; }

.FramioGallery-SideCard.DescCard { display: flex; flex-direction: column; flex: 0 0 auto; }
.FramioGallery-DescContent { padding: 20px; }
.FramioGallery-DescContent h3 { margin: 0 0 10px 0; font-size: 18px; color: var(--heading-color); font-weight: 700; }
.FramioGallery-DescContent p { font-size: 15px; color: var(--text-color); line-height: 1.6; margin: 0; white-space: pre-wrap; }
.FramioGallery-TextClamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; }

/* Edit Form */
.FramioGallery-EditForm { display: flex; flex-direction: column; gap: 10px; padding: 20px; }
.FramioGallery-EditInput { background: var(--body-bg); border: 1px solid var(--overlay-bg); color: var(--text-color); padding: 10px 12px; border-radius: 4px; width: 100%; font-size: 14px; font-family: 'Cairo', sans-serif; font-weight: 700; }
.FramioGallery-EditTextarea { background: var(--body-bg); border: 1px solid var(--overlay-bg); color: var(--text-color); padding: 10px 12px; border-radius: 4px; width: 100%; font-size: 14px; min-height: 100px; resize: vertical; flex: 1; font-family: 'Cairo', sans-serif; }
.FramioGallery-FormActions { display: flex; justify-content: flex-end; gap: 8px; }

.FramioGallery-DescHeader { padding: 15px 20px; background: var(--control-bg-hover); border-bottom: 1px solid var(--border-color, #e0e0e0); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.FramioGallery-DescHeader h4 { margin: 0; font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--muted-color); }
.FramioGallery-DescActions { display: flex; gap: 10px; align-items: center; }
.FramioGallery-EditBtn { background: none; border: none; color: var(--muted-color); cursor: pointer; font-size: 13px; transition: color 0.2s; display: flex; align-items: center; gap: 5px; font-family: 'Cairo', sans-serif; }
.FramioGallery-EditBtn:hover { color: var(--primary-color); }
.FramioGallery-EditBtn.delete:hover { color: #e74c3c; }
.FramioGallery-ReadMore { display: block; width: 100%; margin-top: 10px; background: none; border: none; color: var(--primary-color); font-size: 12px; font-weight: 700; cursor: pointer; text-align: left; padding: 0; text-transform: uppercase; letter-spacing: 0.5px; }
.FramioGallery-ReadMore:hover { text-decoration: underline; }

/* 3. EXIF KARTI */
.FramioGallery-SideCard.ExifCard { padding: 0; gap: 0; display: flex; flex-direction: column; flex: 0 0 auto; }
.ExifCard-Header { background: var(--control-bg-hover); padding: 15px 20px; border-bottom: 1px solid var(--border-color, #e0e0e0); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
.ExifCard-Header h4 { margin: 0; font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--muted-color); letter-spacing: 0.5px; }
.ExifCard-Body { padding: 20px 25px; display: flex; flex-direction: column; justify-content: center; gap: 15px; }
.Exif-Row { display: flex; flex-direction: column; gap: 4px; }
.Exif-Row .label { font-size: 11px; color: var(--muted-color); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
.Exif-Row .value { font-size: 16px; color: var(--heading-color); font-weight: 700; }
.Exif-StatsGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 5px; }
.Exif-Footer { padding: 15px 20px; border-top: 1px solid var(--border-color, #e0e0e0); flex-shrink: 0; background: var(--control-bg-hover); }
.Exif-Footer .label { font-size: 11px; color: var(--muted-color); text-transform: uppercase; font-weight: 700; }
.Exif-Footer .value { font-size: 14px; color: var(--text-color); font-weight: 600; }

@media (max-width: 900px) {
    .FramioGallery-Grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)) !important; gap: 3px; }
    .FramioGallery-ViewControls { display: none; }
    .FramioGallery-Lightbox-Wrapper { height: calc(100% - 60px); }
    .FramioGallery-Lightbox-Body { flex-direction: column; width: 100%; height: 100%; max-height: 100%; max-width: 100%; display: flex; }
    .FramioGallery-ImageContainer { width: 100%; height: 100%; max-width: none; }
    .FramioGallery-ImageContainer img { max-height: 100%; width: 100%; max-width: none; object-fit: contain; }
    .FramioGallery-InfoPanel { width: 100%; height: 0; padding: 0; border-left: none; border-top: 0 solid var(--control-bg); transition: height 0.3s cubic-bezier(0.25, 1, 0.5, 1); visibility: hidden; }
    .FramioGallery-InfoPanel.is-open { width: 100%; height: auto; max-height: 50vh; border-top: none; padding: 15px; visibility: visible; }
    .FramioGallery-Filmstrip { height: 60px; padding: 10px; justify-content: flex-start; }
    .FramioGallery-Thumb { height: 40px; }
    .FramioGallery-Nav { padding: 10px; font-size: 20px; background: rgba(0,0,0,0.5); border: none; }
    .FramioGallery-Nav--prev { left: 5px; }
    .FramioGallery-Nav--next { right: 5px; }
    .FramioGallery-FloatingActions { bottom: 10px; right: 10px; }
}

@keyframes sg-fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;

export default class UserUploadsPage extends UserPage {
  oninit(vnode) {
    super.oninit(vnode);
    this.initialLoading = true;
    this.moreLoading = false;
    this.images = [];
    this.lightboxOpen = false;
    this.infoPanelOpen = false;
    this.shareOpen = false; 
    this.downloadMenuOpen = false; 
    this.currentIndex = 0;
    this.isEditing = false;
    this.editTitle = '';
    this.editDesc = '';
    this.isSaving = false;
    this.gridColumns = 4;
    this.descExpanded = false;
    this.hasMore = false;
    this.limit = 20;

    if (typeof document !== 'undefined' && !document.getElementById('framio-gallery-css')) {
        const style = document.createElement('style');
        style.id = 'framio-gallery-css';
        style.innerHTML = GALLERY_STYLES;
        document.head.appendChild(style);
    }

    this.loadUser(m.route.param('username'));
  }

  // ... (Geri kalan tüm metodlar aynı)
  oncreate(vnode) {
    super.oncreate(vnode);
    this.boundHandleKeydown = this.handleKeydown.bind(this);
    document.addEventListener('keydown', this.boundHandleKeydown);
  }

  onremove(vnode) {
    super.onremove(vnode);
    document.removeEventListener('keydown', this.boundHandleKeydown);
    $('body').removeClass('FramioGallery-NoScroll');
  }

  handleKeydown(e) {
    if (!this.lightboxOpen || this.isEditing) return;
    if (e.key === 'Escape') this.closeLightbox();
    if (e.key === 'ArrowLeft') this.prevImage(e);
    if (e.key === 'ArrowRight') this.nextImage(e);
    if (e.key === 'i' || e.key === 'I') this.toggleInfoPanel();
  }

  show(user) {
    super.show(user);
    this.loadImages(user.id(), 0);
  }

  loadImages(userId, offset = 0) {
    if (offset === 0) {
        this.initialLoading = true;
    } else {
        this.moreLoading = true;
    }
    m.redraw();

    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio-media/images',
      params: { 
          filter: { user: userId },
          page: { offset: offset, limit: this.limit } 
      }
    }).then(response => {
      const newImages = Array.isArray(response) ? response : (response.data || []);
      if (offset === 0) {
          this.images = newImages;
      } else {
          this.images = this.images.concat(newImages);
      }
      this.hasMore = newImages.length >= this.limit;
      this.initialLoading = false;
      this.moreLoading = false;
      m.redraw();
    }).catch(() => {
      this.initialLoading = false;
      this.moreLoading = false;
      m.redraw();
    });
  }

  loadMore() {
      if (this.moreLoading) return;
      this.loadImages(this.user.id(), this.images.length);
  }

  getDisplayUrl(imageItem) {
    if (!imageItem) return '';
    const attr = imageItem.attributes || imageItem;
    return attr.thumb_url || attr.url || attr.path; 
  }

  getOriginalUrl(imageItem) {
    if (!imageItem) return '';
    const attr = imageItem.attributes || imageItem;
    return attr.original_url || attr.url || attr.path;
  }

  forceDownload(url, filename) {
      this.downloadMenuOpen = false; 
      m.redraw();

      app.alerts.show({ type: 'info' }, 'İndirme hazırlanıyor...');

      fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.blob();
        })
        .then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || 'download.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            app.alerts.dismiss(app.alerts.items[0]);
            app.alerts.show({ type: 'success' }, 'İndirme tamamlandı.');
        })
        .catch(() => {
            window.open(url, '_blank');
        });
  }

  deleteImage(image, e) {
    if(e) e.stopPropagation();
    if (!confirm('Bu fotoğrafı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;

    app.request({
        method: 'DELETE',
        url: app.forum.attribute('apiUrl') + '/framio-media/image/' + image.id
    }).then(() => {
        this.images = this.images.filter(i => i.id !== image.id);
        if (this.lightboxOpen) {
            if (this.images.length === 0) this.closeLightbox();
            else if (this.currentIndex >= this.images.length) this.currentIndex = this.images.length - 1;
        }
        app.alerts.show({ type: 'success' }, 'Fotoğraf başarıyla silindi.');
        m.redraw();
    });
  }

  startEditing(attr) {
      this.isEditing = true;
      this.editTitle = attr.title || attr.filename || '';
      this.editDesc = attr.description || '';
      this.descExpanded = true; 
      if (!this.infoPanelOpen) {
          this.infoPanelOpen = true;
      }
      m.redraw();
  }

  cancelEditing() {
      this.isEditing = false;
      this.descExpanded = false; 
      m.redraw();
  }

  deleteMetadata(image) {
      if (!confirm('Açıklamayı silmek istediğinize emin misiniz?')) return;
      this.isSaving = true;
      m.redraw();
      app.request({
          method: 'PATCH',
          url: app.forum.attribute('apiUrl') + '/framio-media/image/' + image.id,
          body: { title: '', description: '' }
      }).then((response) => {
          const currentImgObj = this.images[this.currentIndex];
          if(currentImgObj.attributes) {
              currentImgObj.attributes.title = null;
              currentImgObj.attributes.description = null;
          } else {
              currentImgObj.title = null;
              currentImgObj.description = null;
          }
          this.isSaving = false;
          app.alerts.show({ type: 'success' }, 'Açıklama silindi.');
          m.redraw();
      }).catch(() => {
          this.isSaving = false;
          app.alerts.show({ type: 'error' }, 'Bir hata oluştu.');
          m.redraw();
      });
  }

  saveMetadata(image) {
      this.isSaving = true;
      const currentImgObj = this.images[this.currentIndex];
      if(currentImgObj.attributes) {
          currentImgObj.attributes.title = this.editTitle;
          currentImgObj.attributes.description = this.editDesc;
      } else {
          currentImgObj.title = this.editTitle;
          currentImgObj.description = this.editDesc;
      }
      this.isEditing = false;
      m.redraw();

      app.request({
          method: 'PATCH',
          url: app.forum.attribute('apiUrl') + '/framio-media/image/' + image.id,
          body: { title: this.editTitle, description: this.editDesc }
      }).then((response) => {
          const updatedAttr = (response.image || response.data || response);
          if(currentImgObj.attributes) {
              currentImgObj.attributes.title = updatedAttr.title;
              currentImgObj.attributes.description = updatedAttr.description;
          } else {
              currentImgObj.title = updatedAttr.title;
              currentImgObj.description = updatedAttr.description;
          }
          this.isSaving = false;
          app.alerts.show({ type: 'success' }, 'Bilgiler güncellendi.');
          m.redraw();
      }).catch(() => {
          this.isSaving = false;
          this.isEditing = true;
          app.alerts.show({ type: 'error' }, 'Bir hata oluştu, kaydedilemedi.');
          m.redraw();
      });
  }

  copyBBCode(image, e) {
    if(e) e.stopPropagation();
    const attr = image.attributes || image;
    const bbcode = `[framio-image id=${image.id} url="${attr.thumb_url || attr.url || attr.path}" alt="${attr.filename}"]`;
    const textArea = document.createElement("textarea");
    textArea.value = bbcode;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("Copy");
    textArea.remove();
    app.alerts.show({ type: 'success' }, 'BBCode kopyalandı!');
    this.shareOpen = false; 
  }

  toggleShare(e) {
      if(e) e.stopPropagation();
      this.shareOpen = !this.shareOpen;
      this.downloadMenuOpen = false;
      m.redraw();
  }

  toggleDownloadMenu(e) {
      if(e) e.stopPropagation();
      this.downloadMenuOpen = !this.downloadMenuOpen;
      this.shareOpen = false;
      m.redraw();
  }

  shareSocial(platform, image) {
      const forumTitle = app.forum.attribute('forumTitle') || 'Galeri';
      const url = encodeURIComponent(window.location.href); 
      const text = encodeURIComponent(`${forumTitle} üzerindeki bu fotoğrafa göz atın!`);
      let shareUrl = '';
      switch(platform) {
          case 'twitter': shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`; break;
          case 'facebook': shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`; break;
          case 'whatsapp': shareUrl = `https://api.whatsapp.com/send?text=${text} ${url}`; break;
      }
      if (shareUrl) window.open(shareUrl, '_blank', 'width=600,height=400');
      this.shareOpen = false;
  }

  openLightbox(index) {
    this.currentIndex = index;
    this.lightboxOpen = true;
    this.infoPanelOpen = false;
    this.isEditing = false;
    this.shareOpen = false;
    this.downloadMenuOpen = false;
    this.descExpanded = false; 
    $('body').addClass('FramioGallery-NoScroll');
    m.redraw();
  }

  closeLightbox() {
    this.lightboxOpen = false;
    this.isEditing = false;
    this.shareOpen = false;
    this.downloadMenuOpen = false;
    $('body').removeClass('FramioGallery-NoScroll');
    m.redraw();
  }
  
  toggleInfoPanel(e) {
      if(e) e.stopPropagation();
      this.infoPanelOpen = !this.infoPanelOpen;
      m.redraw();
  }

  setGridColumns(cols) {
      this.gridColumns = cols;
      m.redraw();
  }

  nextImage(e) {
    if(e) e.stopPropagation();
    this.isEditing = false;
    this.shareOpen = false;
    this.downloadMenuOpen = false;
    this.descExpanded = false;
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
    m.redraw();
  }

  prevImage(e) {
    if(e) e.stopPropagation();
    this.isEditing = false;
    this.shareOpen = false;
    this.downloadMenuOpen = false;
    this.descExpanded = false;
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
    m.redraw();
  }

  toggleDescExpand() {
      this.descExpanded = !this.descExpanded;
      m.redraw();
  }

  // --- GÜÇLENDİRİLMİŞ EXIF PARSE ---
  getExifDisplay(exifData) {
      if (!exifData) return this.getEmptyExif();

      let data = exifData;
      if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) { return this.getEmptyExif(); }
      }

      return {
          camera:   data.camera || ((data.make || data.Make || '') + ' ' + (data.model || data.Model || '')).trim() || 'Bilinmiyor',
          lens:     data.lens || data.LensModel || data.Lens || '-',
          exposure: data.exposure || data.ExposureTime || '-',
          aperture: data.aperture || data.FNumber || '-',
          iso:      data.iso || data.ISOSpeedRatings || data.ISO || '-',
          focal:    data.focal || data.FocalLength || '-',
          lat:      data.lat || data.GPSLatitude,
          lon:      data.lon || data.GPSLongitude
      };
  }
  
  getEmptyExif() {
      return { camera: 'Bilinmiyor', lens: '-', exposure: '-', aperture: '-', iso: '-', focal: '-' };
  }

  content() {
    const currentItem = this.images[this.currentIndex];
    const currentAttr = currentItem ? (currentItem.attributes || currentItem) : {};
    
    // EXIF İŞLEME
    let rawExif = currentAttr.exif || currentAttr.exif_data || {};
    const exif = this.getExifDisplay(rawExif);
    
    // TARİH VE SAAT İŞLEME
    let dateTaken = 'Bilinmiyor';
    if (rawExif && (rawExif.DateTimeOriginal || rawExif.date)) {
        const fullDateStr = rawExif.DateTimeOriginal || rawExif.date;
        try {
            const parts = fullDateStr.split(' ');
            const datePart = parts[0];
            const timePart = parts[1];

            const dParts = datePart.split(/[:\-]/);
            if (dParts.length === 3) {
                let formattedDate = `${dParts[2]}.${dParts[1]}.${dParts[0]}`;
                if (timePart) {
                    const timeHm = timePart.substring(0, 8);
                    dateTaken = `${formattedDate} ${timeHm}`;
                } else {
                    dateTaken = formattedDate;
                }
            } else {
                dateTaken = fullDateStr;
            }
        } catch(e) { dateTaken = fullDateStr; }
    } else if (currentAttr.createdAt || currentAttr.created_at) {
        const d = new Date(currentAttr.createdAt || currentAttr.created_at);
        dateTaken = d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    }
    
    const canDelete = app.session.user && (app.session.user.id() === this.user.id() || app.session.user.isAdmin());
    const canEdit = canDelete; 

    const fileName = currentAttr.filename; 
    const descTitle = currentAttr.title;
    const imageDesc = currentAttr.description || '';
    
    const hasDescription = !!(currentAttr.description && currentAttr.description.trim() !== '');
    const showDescCard = hasDescription || this.isEditing;

    const panelOpenClass = this.infoPanelOpen ? 'PanelOpen' : '';

    const charLimit = 150;
    const isLongDesc = imageDesc.length > charLimit;
    const displayDesc = (this.descExpanded || !isLongDesc) ? imageDesc : imageDesc.substring(0, charLimit) + '...';

    return (
      <div className="FramioGallery-Page">
        
        <div className="FramioGallery-Header">
            <h3>{icon('fas fa-images')} Kullanıcı Galerisi</h3>
            
            <div className="FramioGallery-ViewControls">
                <div className={`FramioGallery-ViewBtn ${this.gridColumns === 2 ? 'active' : ''}`} onclick={() => this.setGridColumns(2)} title="2 Sütun">{icon('fas fa-th-large')}</div>
                <div className={`FramioGallery-ViewBtn ${this.gridColumns === 3 ? 'active' : ''}`} onclick={() => this.setGridColumns(3)} title="3 Sütun">{icon('fas fa-th')}</div>
                <div className={`FramioGallery-ViewBtn ${this.gridColumns === 4 ? 'active' : ''}`} onclick={() => this.setGridColumns(4)} title="4 Sütun">{icon('fas fa-border-all')}</div>
            </div>
        </div>

        {this.initialLoading ? (
             <LoadingIndicator />
        ) : this.images.length === 0 ? (
            <div className="FramioGallery-Empty">
              <p>{icon('fas fa-camera-retro')}</p>
              <p>Henüz hiç fotoğraf yüklenmemiş.</p>
            </div>
        ) : (
            <div>
                <div className="FramioGallery-Grid" style={{ gridTemplateColumns: `repeat(${this.gridColumns}, 1fr)` }}>
                  {this.images.map((image, index) => {
                    const imgSrc = this.getDisplayUrl(image); 
                    return (
                      <div className="FramioGallery-Card" onclick={() => this.openLightbox(index)}>
                        <div className="FramioGallery-Card-ImageWrap">
                          <img src={imgSrc} alt={image.filename || 'Fotoğraf'} loading="lazy" />
                        </div>
                        <div className="FramioGallery-Card-Overlay">
                            <div className="FramioGallery-Actions">
                                <button className="FramioGallery-ActionBtn" title="Büyüt">{icon('fas fa-expand')}</button>
                                <button className="FramioGallery-ActionBtn" title="BBCode Kopyala" onclick={(e) => this.copyBBCode(image, e)}>{icon('fas fa-copy')}</button>
                                {canDelete && (
                                    <button className="FramioGallery-ActionBtn delete" title="Sil" onclick={(e) => this.deleteImage(image, e)}>{icon('fas fa-trash')}</button>
                                )}
                            </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {this.hasMore && (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <Button 
                            className="Button Button--primary" 
                            onclick={() => this.loadMore()}
                            loading={this.moreLoading}
                        >
                            Daha Fazla Göster
                        </Button>
                    </div>
                )}
            </div>
        )}

        {this.lightboxOpen && currentItem && (
          <div className="FramioGallery-Lightbox" onclick={() => this.closeLightbox()}>
            <button className="FramioGallery-CloseBtn" onclick={() => this.closeLightbox()} title="Kapat">
                {icon('fas fa-times')}
            </button>

            <div className="FramioGallery-Lightbox-Wrapper" onclick={() => this.closeLightbox()}>
              <button className="FramioGallery-Nav FramioGallery-Nav--prev" onclick={(e) => { e.stopPropagation(); this.prevImage(e); }}>
                {icon('fas fa-chevron-left')}
              </button>

              <div className={`FramioGallery-Lightbox-Body ${panelOpenClass}`} onclick={(e) => e.stopPropagation()}>
                <div className="FramioGallery-Lightbox-ImageArea">
                  <div className="FramioGallery-ImageContainer">
                      <button className={`FramioGallery-InfoToggle ${this.infoPanelOpen ? 'active' : ''}`} onclick={(e) => this.toggleInfoPanel(e)} title="Detaylar">
                        {icon('fas fa-info')}
                      </button>

                      <div className="FramioGallery-FloatingActions" onclick={(e) => e.stopPropagation()}>
                          
                          <div style={{position: 'relative'}}>
                              <button 
                                className="FramioGallery-FloatBtn" 
                                onclick={(e) => this.toggleShare(e)}
                                data-tooltip="Paylaş"
                              >
                                  {icon('fas fa-share-alt')}
                              </button>
                              
                              {this.shareOpen && (
                                  <div className="FramioShare-Popup">
                                      <a className="FramioShare-Item" onclick={() => this.shareSocial('twitter', currentItem)}>{icon('fab fa-twitter')} Twitter</a>
                                      <a className="FramioShare-Item" onclick={() => this.shareSocial('facebook', currentItem)}>{icon('fab fa-facebook')} Facebook</a>
                                      <a className="FramioShare-Item" onclick={() => this.shareSocial('whatsapp', currentItem)}>{icon('fab fa-whatsapp')} WhatsApp</a>
                                      <div className="FramioShare-Item" onclick={(e) => this.copyBBCode(currentItem, e)}>{icon('fas fa-link')} BBCode Kopyala</div>
                                  </div>
                              )}
                          </div>

                          <div style={{position: 'relative'}}>
                              <button 
                                className="FramioGallery-FloatBtn" 
                                onclick={(e) => this.toggleDownloadMenu(e)}
                                data-tooltip="İndir"
                              >
                                {icon('fas fa-download')}
                              </button>

                              {this.downloadMenuOpen && (
                                <div className="FramioDownload-Popup">
                                    <div 
                                        className="FramioDownload-Item"
                                        onclick={(e) => { e.stopPropagation(); this.forceDownload(this.getDisplayUrl(currentItem), 'thumb_' + fileName); }}
                                    >
                                        <div className="dl-title">{icon('fas fa-image')} Standart Çözünürlük</div>
                                        <div className="dl-info">Web için optimize edilmiş versiyon</div>
                                    </div>
                                    
                                    <div 
                                        className="FramioDownload-Item"
                                        onclick={(e) => { e.stopPropagation(); this.forceDownload(this.getOriginalUrl(currentItem), 'high_res_' + fileName); }}
                                    >
                                        <div className="dl-title">{icon('fas fa-file-image')} Yüksek Çözünürlük</div>
                                        <div className="dl-info">Tam kalite orijinal versiyon</div>
                                    </div>
                                </div>
                              )}
                          </div>
                          
                          {/* FOTOĞRAFI SİL BUTONU */}
                          {canDelete && (
                              <button 
                                className="FramioGallery-FloatBtn danger" 
                                onclick={(e) => this.deleteImage(currentItem, e)}
                                data-tooltip="Fotoğrafı Sil"
                              >
                                  {icon('fas fa-trash-alt')}
                              </button>
                          )}

                          {(!hasDescription && canEdit && !this.isEditing) && (
                              <button 
                                className="FramioGallery-FloatBtn primary" 
                                onclick={() => this.startEditing(currentAttr)}
                                data-tooltip="Açıklama Ekle"
                              >
                                  {icon('fas fa-pencil-alt')}
                              </button>
                          )}

                          <a 
                            href={this.getOriginalUrl(currentItem)} 
                            target="_blank" 
                            className="FramioGallery-FloatBtn"
                            data-tooltip="Orijinal Boyut (Yeni Sekme)"
                          >
                            {icon('fas fa-external-link-alt')}
                          </a>
                      </div>

                      <img src={this.getDisplayUrl(currentItem)} alt={currentAttr.filename} />
                      
                      {!this.infoPanelOpen && (
                          <div className="FramioGallery-OverlayTitle">
                              {fileName}
                          </div>
                      )}
                  </div>
                </div>

                <div className={`FramioGallery-InfoPanel ${this.infoPanelOpen ? 'is-open' : ''}`}>
                    <div className="FramioGallery-InfoContent">
                        
                        <div className="FramioGallery-SideCard TitleCard">
                            <h2>{fileName}</h2>
                        </div>

                        {(showDescCard) && (
                            <div className="FramioGallery-SideCard DescCard">
                                {!this.isEditing && (
                                    <div className="FramioGallery-DescHeader">
                                        <h4>FOTOĞRAF AÇIKLAMASI</h4>
                                        {canEdit && (
                                            <div className="FramioGallery-DescActions">
                                                {hasDescription && (
                                                    <button 
                                                        className="FramioGallery-EditBtn delete" 
                                                        onclick={() => this.deleteMetadata(currentItem)} 
                                                        title="Açıklamayı Sil"
                                                        style={{marginRight: '10px'}}
                                                    >
                                                        {icon('fas fa-trash')}
                                                    </button>
                                                )}
                                                <button 
                                                    className="FramioGallery-EditBtn" 
                                                    onclick={() => this.startEditing(currentAttr)} 
                                                    title="Düzenle"
                                                >
                                                    {icon('fas fa-pencil-alt')} Düzenle
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {this.isEditing ? (
                                    <div className="FramioGallery-EditForm">
                                        <input className="FramioGallery-EditInput" type="text" placeholder="Başlık" value={this.editTitle} oninput={e => this.editTitle = e.target.value} />
                                        <textarea className="FramioGallery-EditTextarea" placeholder="Fotoğrafın hikayesini yazın..." value={this.editDesc} oninput={e => this.editDesc = e.target.value}></textarea>
                                        <div className="FramioGallery-FormActions">
                                            <button className="FramioGallery-Btn small" onclick={() => this.cancelEditing()}>İptal</button>
                                            <button className="FramioGallery-Btn primary small" onclick={() => this.saveMetadata(currentItem)} disabled={this.isSaving}>
                                                {this.isSaving ? '...' : 'Kaydet'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="FramioGallery-DescContent">
                                        {descTitle && <h3>{descTitle}</h3>}
                                        <p className={!this.descExpanded && isLongDesc ? 'FramioGallery-TextClamp' : ''}>
                                            {imageDesc}
                                        </p>
                                        
                                        {isLongDesc && (
                                            <button 
                                                className="FramioGallery-ReadMore"
                                                onclick={() => this.toggleDescExpand()}
                                            >
                                                {this.descExpanded ? 'Daha Az Göster' : 'Devamını Gör'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="FramioGallery-SideCard ExifCard">
                            <div className="ExifCard-Header">
                                <h4>FOTOĞRAF BİLGİLERİ (EXIF)</h4>
                            </div>
                            <div className="ExifCard-Body">
                                <div className="Exif-Row">
                                    <span className="label">Kamera</span>
                                    <span className="value">{exif.camera}</span>
                                </div>
                                <div className="Exif-Row">
                                    <span className="label">Lens</span>
                                    <span className="value">{exif.lens}</span>
                                </div>
                                <div className="Exif-StatsGrid">
                                    <div className="Exif-Row">
                                        <span className="label">Enstantane</span>
                                        <span className="value">{exif.exposure}</span>
                                    </div>
                                    <div className="Exif-Row">
                                        <span className="label">Diyafram</span>
                                        <span className="value">{exif.aperture}</span>
                                    </div>
                                    <div className="Exif-Row">
                                        <span className="label">ISO</span>
                                        <span className="value">{exif.iso}</span>
                                    </div>
                                    <div className="Exif-Row">
                                        <span className="label">Odak Uzaklığı</span>
                                        <span className="value">{exif.focal}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="Exif-Footer">
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                                    <div style={{display: 'flex', flexDirection: 'column'}}>
                                        <span className="label">Çekim Tarihi</span>
                                        <span className="value">{dateTaken}</span>
                                    </div>
                                    
                                    {(exif.lat && exif.lon) && (
                                        <a 
                                            href={`https://www.google.com/maps?q=${exif.lat},${exif.lon}`} 
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
                                            title="Konumu Haritada Aç"
                                        >
                                            {icon('fas fa-map-marker-alt')} Haritada Gör
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
              </div>
              <button className="FramioGallery-Nav FramioGallery-Nav--next" onclick={(e) => { e.stopPropagation(); this.nextImage(e); }}>
                {icon('fas fa-chevron-right')}
              </button>
            </div>

            <div className="FramioGallery-Filmstrip" onclick={(e) => e.stopPropagation()}>
                {this.images.map((img, idx) => (
                    <div 
                        className={`FramioGallery-Thumb ${this.currentIndex === idx ? 'active' : ''}`}
                        onclick={() => this.openLightbox(idx)}
                    >
                        <img src={this.getDisplayUrl(img)} alt="thumbnail" loading="lazy" />
                    </div>
                ))}
            </div>

          </div>
        )}
      </div>
    );
  }
}
