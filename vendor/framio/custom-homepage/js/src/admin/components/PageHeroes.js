import Switch from 'flarum/common/components/Switch';
import Select from 'flarum/common/components/Select';

/**
 * Akış ve Galeri sayfalarının üstündeki başlık alanı.
 * framio-custom-homepage.page_heroes = { feed: {...}, gallery: {...} }
 */

const KEY = 'framio-custom-homepage.page_heroes';

const PAGES = {
  feed: { name: 'Akış', title: 'Akış', icon: 'fas fa-stream', pageIcon: 'fas fa-stream' },
  gallery: { name: 'Galeri', title: 'Galeri', icon: 'fas fa-camera-retro', pageIcon: 'fas fa-camera-retro' },
};

export default class PageHeroes {
  constructor(page) {
    this.page = page;
    this.setting = page.setting(KEY, '{}');
    try {
      this.data = JSON.parse(this.setting() || '{}') || {};
    } catch (e) {
      this.data = {};
    }
  }

  get(p) {
    return (this.data[p] = this.data[p] || {});
  }

  set(p, k, v) {
    // Boş bırakılan alan varsayılana döner
    if (v === '') delete this.get(p)[k];
    else this.get(p)[k] = v;
    this.setting(JSON.stringify(this.data));
  }

  view() {
    return Object.keys(PAGES).map((p) => this.viewPage(p));
  }

  viewPage(p) {
    const d = PAGES[p];
    const c = this.get(p);
    const set = (k, v) => this.set(p, k, v);
    const active = c.active !== false;

    return this.page.card(
      d.pageIcon,
      d.name + ' Sayfası Başlığı',
      `"${d.name}" sayfasının üstündeki başlık alanı.`,
      active ? (
        <div>
          {this.preview(p)}
          <div className="CHS-Menu-Body CHS-Menu-Body--flat">
            <div className="CHS-Menu-Field">
              <label>Başlık</label>
              <input className="FormControl" placeholder={d.title} value={c.title == null ? '' : c.title} oninput={(e) => set('title', e.target.value)} />
            </div>
            <div className="CHS-Menu-Field">
              <label>İkon</label>
              <div className="CHS-Menu-IconInput">
                <span><i className={c.icon == null ? d.icon : c.icon}></i></span>
                <input className="FormControl" placeholder={d.icon} value={c.icon == null ? '' : c.icon} oninput={(e) => set('icon', e.target.value.trim())} />
              </div>
            </div>
            <div className="CHS-Menu-Field" style={{ gridColumn: '1 / -1' }}>
              <label>Alt başlık / açıklama</label>
              <input className="FormControl" placeholder="İsteğe bağlı, başlığın altında küçük yazı" value={c.subtitle || ''} oninput={(e) => set('subtitle', e.target.value)} />
            </div>
            <div className="CHS-Menu-Field">
              <label>Hizalama</label>
              {Select.component({ options: { center: 'Ortada', left: 'Solda' }, value: c.align || 'center', onchange: (v) => set('align', v) })}
            </div>
            <div className="CHS-Menu-Field">
              <label>Yükseklik</label>
              {Select.component({ options: { compact: 'İnce', normal: 'Normal', large: 'Geniş' }, value: c.size || 'normal', onchange: (v) => set('size', v) })}
            </div>
            <div className="CHS-Menu-Field">
              <label>Arka plan rengi</label>
              <div className="CHS-Menu-IconInput">
                <input type="color" value={c.bgColor || '#eeeeee'} oninput={(e) => set('bgColor', e.target.value)} style={{ width: '44px', padding: 0, border: 0, background: 'none' }} />
                <input className="FormControl" placeholder="Tema varsayılanı" value={c.bgColor || ''} oninput={(e) => set('bgColor', e.target.value.trim())} />
              </div>
            </div>
            <div className="CHS-Menu-Field">
              <label>Yazı rengi</label>
              <div className="CHS-Menu-IconInput">
                <input type="color" value={c.textColor || '#333333'} oninput={(e) => set('textColor', e.target.value)} style={{ width: '44px', padding: 0, border: 0, background: 'none' }} />
                <input className="FormControl" placeholder="Tema varsayılanı" value={c.textColor || ''} oninput={(e) => set('textColor', e.target.value.trim())} />
              </div>
            </div>
            <div className="CHS-Menu-Field" style={{ gridColumn: '1 / -1' }}>
              <label>Arka plan görseli (bağlantı)</label>
              <input className="FormControl" placeholder="https://... (boşsa düz renk)" value={c.bgImage || ''} oninput={(e) => set('bgImage', e.target.value.trim())} />
            </div>
            {c.bgImage ? (
              <div className="CHS-Menu-Field CHS-Menu-Inline">
                <Switch state={c.overlay !== false} onchange={(v) => set('overlay', v)}>Görselin üstüne koyu katman (yazı okunaklı olsun)</Switch>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="CHS-Menu-Note"><i className="fas fa-eye-slash"></i> Başlık alanı bu sayfada gösterilmiyor.</div>
      ),
      <Switch state={active} onchange={(v) => set('active', v)}>Göster</Switch>
    );
  }

  preview(p) {
    const d = PAGES[p];
    const c = this.get(p);
    const pad = { compact: '12px', normal: '24px', large: '48px' }[c.size] || '24px';
    const style = { padding: pad + ' 20px', textAlign: c.align || 'center', borderRadius: '8px', marginBottom: '14px', background: c.bgColor || 'var(--control-bg)' };
    if (c.bgImage) {
      style.backgroundImage = (c.overlay !== false ? 'linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), ' : '') + 'url(' + c.bgImage + ')';
      style.backgroundSize = 'cover';
      style.backgroundPosition = 'center';
    }
    const color = c.textColor || (c.bgImage ? '#fff' : undefined);
    const title = c.title == null ? d.title : c.title;
    const icon = c.icon == null ? d.icon : c.icon;
    return (
      <div style={style}>
        <div style={{ fontSize: '22px', fontWeight: 700, color }}>
          {icon ? <i className={icon} style={{ marginRight: title ? '10px' : 0 }}></i> : null}
          {title}
        </div>
        {c.subtitle ? <div style={{ fontSize: '13px', opacity: 0.85, color, marginTop: '4px' }}>{c.subtitle}</div> : null}
      </div>
    );
  }
}
