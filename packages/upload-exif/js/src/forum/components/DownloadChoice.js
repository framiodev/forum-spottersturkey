import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';

/**
 * Fotoğraf indirme düğmesi. Admin ayarı "Her seferinde sor" ise tıklanınca JPG / WebP seçimi açılır;
 * "Her zaman JPG/WebP" ise doğrudan o biçimde indirir. Dosya sunucuda EXIF ve başlık bilgileriyle hazırlanır.
 *
 * Görsel kartları Mithril'in otomatik yeniden çizimi dışında çizilebildiği için menü, durum yerine
 * doğrudan sınıf değişikliğiyle açılıp kapanır.
 *
 * attrs: imageId, className (düğme sınıfı), tooltip, tooltipAttr ('title' | 'data-tooltip'), menuPlacement ('down' | 'up')
 */
export default class DownloadChoice extends Component {
  oncreate(vnode) {
    super.oncreate(vnode);
    this.closeOnOutside = (e) => {
      if (this.element && !this.element.contains(e.target)) this.setOpen(false);
    };
    document.addEventListener('click', this.closeOnOutside, true);
  }

  onremove(vnode) {
    super.onremove(vnode);
    document.removeEventListener('click', this.closeOnOutside, true);
  }

  setOpen(open) {
    if (this.element) this.element.classList.toggle('is-open', open);
  }

  mode() {
    const mode = app.forum.attribute('framio-upload-exif.download_format_mode');
    return ['jpg', 'webp', 'ask'].includes(mode) ? mode : 'ask';
  }

  start(format) {
    const a = document.createElement('a');
    a.href = app.forum.attribute('apiUrl') + '/framio-media/download/' + this.attrs.imageId + (format ? '?format=' + format : '');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.setOpen(false);
    app.alerts.show({ type: 'success' }, 'Fotoğraf hazırlanıyor, indirme birazdan başlayacak…');
  }

  view() {
    const { className = '', tooltip = 'Fotoğrafı İndir', tooltipAttr = 'title', menuPlacement = 'down' } = this.attrs;
    const mode = this.mode();
    const pick = (format) => (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.start(format);
    };

    return (
      <span className="FramioDownload" onclick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={className}
          {...{ [tooltipAttr]: tooltip }}
          onclick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (mode === 'ask') this.setOpen(!this.element.classList.contains('is-open'));
            else this.start(mode);
          }}
        >
          <i className="fas fa-download"></i>
        </button>

        {mode === 'ask' && (
          <div className={'FramioDownload-menu FramioDownload-menu--' + menuPlacement}>
            <div className="FramioDownload-title">İndirme biçimi</div>
            <button type="button" className="FramioDownload-option" onclick={pick('jpg')}>
              <strong>JPG</strong>
              <span>En uyumlu biçim · EXIF ve künye bilgileriyle</span>
            </button>
            <button type="button" className="FramioDownload-option" onclick={pick('webp')}>
              <strong>WebP</strong>
              <span>Daha küçük dosya · EXIF bilgileriyle</span>
            </button>
          </div>
        )}
      </span>
    );
  }
}
