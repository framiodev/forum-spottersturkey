import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
// Flarum 2'de icon yardımcısı yok; düz <i> yeterli
const icon = (name) => <i className={'icon ' + name} aria-hidden="true" />;

/**
 * Derleme sayfası lightbox'ı. Görünüm custom-homepage galerisinin
 * SpottersGallery-* sınıflarını kullanır; böylece forumdaki lightbox ile
 * aynı görünür. Sağ/sol: sıradaki kart, iç oklar: kartın fotoğrafları.
 *
 * attrs: items, index, onclose, onchange(index)
 */
export default class HubLightbox extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.index = this.attrs.index || 0;
    this.imageIndex = 0;
    this.infoOpen = false;
    this.onkey = this.onkey.bind(this);
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    document.addEventListener('keydown', this.onkey);
    document.body.classList.add('SpottersGallery-NoScroll');
  }

  onremove(vnode) {
    super.onremove(vnode);
    document.removeEventListener('keydown', this.onkey);
    document.body.classList.remove('SpottersGallery-NoScroll');
  }

  onkey(e) {
    if (e.key === 'Escape') this.attrs.onclose();
    else if (e.key === 'ArrowLeft') this.go(-1, e);
    else if (e.key === 'ArrowRight') this.go(1, e);
    else if (e.key === 'i' || e.key === 'I') this.toggleInfo(e);
    else return;
    m.redraw();
  }

  go(dir, e) {
    if (e) e.stopPropagation();
    const n = this.attrs.items.length;
    this.index = (this.index + dir + n) % n;
    this.imageIndex = 0;
    if (this.attrs.onchange) this.attrs.onchange(this.index);
  }

  goImage(dir, e) {
    if (e) e.stopPropagation();
    const n = this.photos().length;
    this.imageIndex = (this.imageIndex + dir + n) % n;
  }

  toggleInfo(e) {
    if (e) e.stopPropagation();
    this.infoOpen = !this.infoOpen;
  }

  item() {
    return this.attrs.items[this.index];
  }

  /**
   * Mesaj künyesi: custom-homepage galerisindeki gibi mesajın HTML'i,
   * görseller ayıklanmış. Çoklu açıklamada yalnızca bu aracın künyesi.
   */
  kunyeHtml(it) {
    if (it.kunyeHtml !== undefined || it.kunyeLoading) return it.kunyeHtml || '';
    it.kunyeLoading = true;
    app.store
      .find('posts', it.postId)
      .then((post) => {
        it.kunyeHtml = this.cleanHtml(post.contentHtml() || '', it);
      })
      .catch(() => {
        it.kunyeHtml = '';
      })
      .then(() => {
        it.kunyeLoading = false;
        m.redraw();
      });
    return '';
  }

  cleanHtml(html, it) {
    const box = document.createElement('div');
    box.innerHTML = html;
    box.querySelectorAll('img, figure, hr, .framio-image, .SpotterImage, [data-spotter-id]').forEach((el) => el.remove());

    // Birden çok künye varsa bu kartın aracına ait olanı seç
    const cards = Array.from(box.querySelectorAll('.framio-kunye-card, ul'));
    if (cards.length > 1) {
      const key = (it.title || '').split(' - ')[0].trim();
      const match = cards.find((c) => key && c.textContent.replace(/\s+/g, ' ').includes(key));
      if (match) return match.outerHTML;
    }

    // Trivia / meraklısına kısmı lightbox'ta gösterilmez (konuda okunur)
    let out = box.innerHTML.replace(/<p>\s*<\/p>/gi, '').trim();
    const trivia = out.search(/(T[\s ]*R[\s ]*[Iİ][\s ]*V[\s ]*[Iİ][\s ]*A|Merakl[ıi]s[ıi]na[\s ]*[Iİiı]nfo)/i);
    if (trivia > -1) {
      const cut = Math.max(out.lastIndexOf('<blockquote', trivia), out.lastIndexOf('<p', trivia), out.lastIndexOf('<br', trivia));
      out = out.substring(0, cut > -1 && trivia - cut < 150 ? cut : trivia);
    }
    return out;
  }

  photos() {
    const it = this.item();
    if (it.photos && it.photos.length) return it.photos;
    return [{ url: it.image, original: it.imageOriginal, exif: null }];
  }

  exif(data) {
    const d = data || {};
    const make = d.make || d.Make || '';
    const model = d.model || d.Model || '';
    let camera = d.camera || (make && model ? (model.toLowerCase().includes(make.toLowerCase()) ? model : make + ' ' + model) : model || make) || 'Bilinmiyor';
    let date = d.datetime_original || d.DateTimeOriginal || d.datetime || d.DateTime || d.date || 'Bilinmiyor';
    if (date !== 'Bilinmiyor') {
      const [day, time] = String(date).split(' ');
      const p = day.split(':');
      if (p.length === 3) date = `${p[2]}.${p[1]}.${p[0]}` + (time ? ' ' + time.substring(0, 5) : '');
    }

    return {
      camera,
      lens: d.lens || d.LensModel || d.Lens || '-',
      exposure: d.exposure || d.exposure_time || d.ExposureTime || '-',
      aperture: d.aperture || d.f_number || d.FNumber || '-',
      iso: d.iso || d.ISOSpeedRatings || d.ISO || '-',
      focal: d.focal || d.focal_length || d.FocalLength || '-',
      date,
    };
  }

  view() {
    const it = this.item();
    if (!it) return null;
    const photos = this.photos();
    const photo = photos[Math.min(this.imageIndex, photos.length - 1)];
    const exif = this.exif(photo.exif);
    const kunye = this.kunyeHtml(it);
    const close = () => this.attrs.onclose();

    return (
      <div className="SpottersGallery-Lightbox FramioHubLightbox" onclick={close}>
        <button className="SpottersGallery-CloseBtn" onclick={close} title="Kapat">
          {icon('fas fa-times')}
        </button>

        <div className="SpottersGallery-Lightbox-Wrapper" onclick={close}>
          {this.attrs.items.length > 1 ? (
            <button className="OuterNav Prev" onclick={(e) => this.go(-1, e)}>
              {icon('fas fa-chevron-left')}
            </button>
          ) : null}

          <div className={'SpottersGallery-Lightbox-Body ' + (this.infoOpen ? 'PanelOpen' : '')} onclick={(e) => e.stopPropagation()}>
            <div className="SpottersGallery-Lightbox-ImageArea">
              <div className="SpottersGallery-ImageContainer">
                <button className={'SpottersGallery-InfoToggle ' + (this.infoOpen ? 'active' : '')} onclick={(e) => this.toggleInfo(e)} title="Detaylar">
                  {icon('fas fa-info')}
                </button>

                {photos.length > 1 ? [
                  <button key="p" className="SpottersGallery-InnerNav prev" onclick={(e) => this.goImage(-1, e)}>{icon('fas fa-angle-left')}</button>,
                  <button key="n" className="SpottersGallery-InnerNav next" onclick={(e) => this.goImage(1, e)}>{icon('fas fa-angle-right')}</button>,
                ] : null}

                <div className="SpottersGallery-FloatingActions" onclick={(e) => e.stopPropagation()}>
                  <a href={it.url} target="_blank" rel="noopener" className="SpottersGallery-FloatBtn primary" data-tooltip="Konuya Git">
                    {icon('fas fa-external-link-square-alt')}
                  </a>
                  {photo.original ? (
                    <a href={photo.original} target="_blank" rel="noopener" className="SpottersGallery-FloatBtn" data-tooltip="Orijinal Boyut">
                      {icon('fas fa-expand-arrows-alt')}
                    </a>
                  ) : null}
                </div>

                <img src={photo.url} alt={it.alt || it.title} />

                {!this.infoOpen ? <div className="SpottersGallery-OverlayTitle">{it.title}</div> : null}
              </div>
            </div>

            <div className={'SpottersGallery-InfoPanel ' + (this.infoOpen ? 'is-open' : '')}>
              <div className="SpottersGallery-InfoContent">
                <div className="SpottersGallery-SideCard TitleCard">
                  <h2>{it.title}</h2>
                </div>
                <div className="SpottersGallery-SideCard DescCard">
                  <div className="SpottersGallery-DescHeader">
                    <h4>MESAJ KÜNYESİ</h4>
                  </div>
                  <div className="SpottersGallery-DescContent" data-post-id={it && it.postId ? String(it.postId) : undefined}>
                    {kunye ? m.trust(kunye) : <p>{it.discussion}{it.author ? ' · ' + it.author : ''}</p>}
                  </div>
                </div>
                <div className="SpottersGallery-SideCard ExifCard">
                  <div className="ExifCard-Header"><h4>FOTOĞRAF BİLGİLERİ (EXIF)</h4></div>
                  <div className="ExifCard-Body">
                    <div className="Exif-Row"><span className="label">Kamera</span><span className="value">{exif.camera}</span></div>
                    <div className="Exif-Row"><span className="label">Lens</span><span className="value">{exif.lens}</span></div>
                    <div className="Exif-StatsGrid">
                      <div className="Exif-Row"><span className="label">Enstantane</span><span className="value">{exif.exposure}</span></div>
                      <div className="Exif-Row"><span className="label">Diyafram</span><span className="value">{exif.aperture}</span></div>
                      <div className="Exif-Row"><span className="label">ISO</span><span className="value">{exif.iso}</span></div>
                      <div className="Exif-Row"><span className="label">Odak Uzaklığı</span><span className="value">{exif.focal}</span></div>
                    </div>
                  </div>
                  <div className="Exif-Footer">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="label">Çekim Tarihi</span>
                      <span className="value">{exif.date}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {this.attrs.items.length > 1 ? (
            <button className="OuterNav Next" onclick={(e) => this.go(1, e)}>
              {icon('fas fa-chevron-right')}
            </button>
          ) : null}
        </div>

        {photos.length > 1 ? (
          <div className="SpottersGallery-Filmstrip" onclick={(e) => e.stopPropagation()}>
            {photos.map((p, idx) => (
              <div key={idx} className={'SpottersGallery-Thumb ' + (this.imageIndex === idx ? 'active' : '')} onclick={(e) => { e.stopPropagation(); this.imageIndex = idx; }}>
                <img src={p.url} alt="" loading="lazy" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
}
