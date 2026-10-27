import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';

/**
 * Fotoğraf paylaş akışı (maket 6), 3. adım: yazma penceresinin üstünde telefon paylaşım ekranı.
 * Ham BBCode metni yerine fotoğraf önizlemesi + künye kartı + başlık + kategori + Paylaş.
 * Veri yazma penceresinin kendisinde kalır (fields.content / title / tags); gönderme, pencerenin kendi
 * gönder düğmesiyle yapılır. "Metni düzenle" ham düzenleyiciyi gösterir.
 */
export default class MobileComposeSheet extends Component {
  view() {
    const c = app.composer;
    const phone = window.matchMedia('(max-width: 767px)').matches;
    // Pencere kapanınca "Metni düzenle" tercihi sıfırlanır: bir sonraki paylaşım yine bu ekranla açılır
    if (c && c.isVisible && !c.isVisible() && c.mobileRaw) c.mobileRaw = undefined;
    const content = c && c.fields && c.fields.content ? c.fields.content() || '' : '';
    const visible = phone && c && c.isVisible && c.isVisible() && /\[framio-image\b/i.test(content) && c.mobileRaw !== true;
    document.documentElement.classList.toggle('MobileCompose-open', !!visible);
    if (!visible) return <div className="MobileCompose-off" />;

    // Önizleme verisi metinden: görseller ve künye satırları
    const images = [...content.matchAll(/\[framio-image\b[^\]]*?url="([^"]+)"/gi)].map((x) => x[1]);
    const kunye = [...content.matchAll(/^-\s*\*\*(.+?)\*\*\s*$/gm)].map((x) => x[1]);
    const isDiscussion = !!(c.fields.title);
    const title = isDiscussion ? c.fields.title() || '' : '';
    const tags = (c.fields.tags || []).filter(Boolean);
    if (this.index === undefined || this.index >= images.length) this.index = 0;

    return (
      <div className="MobileCompose" role="dialog" aria-label="Paylaşımı tamamla">
        <div className="MobileShare-top">
          <button type="button" className="MobileShare-x" aria-label="Kapat" onclick={() => this.exit()}>✕</button>
          <b>{isDiscussion ? 'Yeni paylaşım' : 'Yanıt'}</b>
          <button type="button" className="MobileShare-next" disabled={this.sending} onclick={() => this.submit()}>Paylaş</button>
        </div>
        <div className="MobileShare-steps"><i className="on" /><i className="on" /><i className="on" /></div>

        <div className="MobileShare-scroll">
          {images.length ? (
            <div className="MobileCompose-media">
              <div className="MobileCompose-track" onscroll={(e) => { const n = Math.round(e.target.scrollLeft / e.target.clientWidth); if (n !== this.index) { this.index = n; m.redraw(); } }}>
                {images.map((src) => <div className="MobileCompose-slide" style={{ backgroundImage: 'url(' + src + ')' }} />)}
              </div>
              {images.length > 1 ? <span className="MobileCompose-count">{this.index + 1 + ' / ' + images.length}</span> : null}
            </div>
          ) : null}

          {kunye.length ? (
            <div className="MobileCompose-box">
              <div className="MobileCompose-label">Künye</div>
              <ul className="MobileCompose-kunye">{kunye.slice(0, 12).map((k) => <li>{k}</li>)}</ul>
            </div>
          ) : null}

          {isDiscussion ? (
            <div className="MobileCompose-box">
              <label className="MobileCompose-label" for="mc-title">Başlık</label>
              <input id="mc-title" className="MobileCompose-input" placeholder="Örn. Lisinya Tur MAN Lion's Coach" value={title}
                oninput={(e) => c.fields.title(e.target.value)} />
            </div>
          ) : null}

          {isDiscussion ? (
            <div className="MobileCompose-box">
              <div className="MobileCompose-label">Kategori</div>
              <button type="button" className="MobileCompose-tags" onclick={() => this.pickTags()}>
                {tags.length ? tags.map((t) => <span className="MobileCompose-tag" style={{ background: t.color() || 'var(--control-bg)' }}>{t.name()}</span>)
                  : <span className="MobileCompose-placeholder">Kategori seç</span>}
                <i className="icon fas fa-chevron-right" />
              </button>
            </div>
          ) : null}

          <button type="button" className="MobileCompose-raw" onclick={() => { c.mobileRaw = true; }}>
            <i className="icon fas fa-code" /> Metni düzenle
          </button>
        </div>
      </div>
    );
  }

  // Kategori seçimi: Tags eklentisinin yazma penceresindeki kendi düğmesi (aynı modal ve kurallar)
  pickTags() {
    const btn = document.querySelector('.Composer .DiscussionComposer-changeTags');
    if (btn) btn.click();
  }

  // Gönderme: yazma penceresinin kendi gönder düğmesi (doğrulama ve kaydetme aynı kalır)
  submit() {
    const c = app.composer;
    if (c.fields.title && !String(c.fields.title() || '').trim()) {
      app.alerts.show({ type: 'error' }, 'Lütfen bir başlık yaz.');
      const el = document.getElementById('mc-title');
      if (el) el.focus();
      return;
    }
    const btn = document.querySelector('.Composer .item-submit .Button, .Composer .item-submit button');
    if (btn) btn.click();
    else app.alerts.show({ type: 'error' }, 'Gönder düğmesi bulunamadı; "Metni düzenle" ile ekrandan gönderebilirsin.');
  }

  exit() {
    app.composer.mobileRaw = true;
    // Yazma penceresinin kendi kapatma onayı (taslak / vazgeç) çalışsın
    const close = document.querySelector('.Composer .item-close .Button, .Composer .item-close button');
    if (close) close.click();
    else app.composer.close();
    // Kapatma onayından vazgeçilirse paylaşım ekranı geri gelir
    setTimeout(() => { app.composer.mobileRaw = undefined; m.redraw(); }, 400);
  }
}
