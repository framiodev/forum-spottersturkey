import app from 'flarum/admin/app';
import Switch from 'flarum/common/components/Switch';
import Select from 'flarum/common/components/Select';
import Button from 'flarum/common/components/Button';
import { HEADER_STYLE_DEFAULTS, headerStyleVars } from '../../common/headerStyle';

/**
 * Header menüsü görünümü: canlı önizleme + ayrıntılı ayarlar.
 * Değerler nav_header.style içinde saklanır; önizleme forumla aynı CSS
 * değişkenlerini kullanır (common/headerStyle.js).
 */
export default class HeaderStyleEditor {
  constructor(manager) {
    this.manager = manager;
    this.previewWidth = 'desktop';
  }

  // ───────────────────────── Kontroller

  slider(st, key, min, max, step, unit, set) {
    return (
      <div className="CHS-HS-Slider">
        <input type="range" min={min} max={max} step={step || 1} value={st[key]} oninput={(e) => set(key, Number(e.target.value))} />
        <span>{st[key]}{unit}</span>
      </div>
    );
  }

  color(st, key, set, placeholder) {
    return (
      <div className="CHS-HS-Color">
        <input type="color" value={st[key] || '#888888'} oninput={(e) => set(key, e.target.value)} />
        <input className="FormControl" placeholder={placeholder || 'Tema varsayılanı'} value={st[key] || ''} oninput={(e) => set(key, e.target.value.trim())} />
        {st[key] ? (
          <button type="button" className="CHS-HS-Clear" title="Varsayılana dön" onclick={() => set(key, '')}>
            <i className="fas fa-undo"></i>
          </button>
        ) : null}
      </div>
    );
  }

  field(label, control, help) {
    return (
      <div className="CHS-HS-Field">
        <label>{label}</label>
        {control}
        {help ? <small>{help}</small> : null}
      </div>
    );
  }

  group(icon, title, fields) {
    return (
      <div className="CHS-HS-Group">
        <h5><i className={icon}></i> {title}</h5>
        <div className="CHS-HS-Fields">{fields}</div>
      </div>
    );
  }

  // ───────────────────────── Önizleme

  /** Önizlemede gösterilecek öğeler (ad, ikon, alt öğe var mı) */
  previewEntries(c) {
    const mgr = this.manager;
    const source = c.source === 'custom' ? c.items || [] : mgr.items;
    return source
      .map((i, srcIndex) => ({ i, srcIndex }))
      .filter(({ i }) => i && !i.hidden && (c.source === 'custom' || i.top !== false))
      .map(({ i, srcIndex }) => {
        const def = mgr.defaults(i.key);
        const isCat = i.key === '__categories';
        return {
          key: i.key,
          label: i.label || (isCat ? 'Kategoriler' : def.label) || (i.custom ? i.url || 'Bağlantı' : i.key),
          icon: i.icon || (isCat ? 'fas fa-tags' : def.icon) || (i.custom ? 'fas fa-link' : 'fas fa-circle'),
          kids: isCat ? [{ label: 'Kategori 1' }, { label: 'Kategori 2' }] : (i.children || []).filter((k) => !k.hidden),
          home: i.key === 'tags',
          srcIndex,
          locked: c.source !== 'custom' && i.key === '__categories',
        };
      });
  }

  /** Önizlemede bir öğeyi başka bir öğenin yerine bırakınca menü sırasını değiştir */
  reorder(c, save, from, to) {
    if (from === to || from == null || to == null) return;
    if (c.source === 'custom') {
      const list = c.items || [];
      const [x] = list.splice(from, 1);
      list.splice(to, 0, x);
      save();
    } else {
      this.manager.move(from, to);
    }
  }

  viewPreview(c, st, save) {
    const { vars, classes } = headerStyleVars(st);
    const entries = this.previewEntries(c);
    const home = st.homeIcon ? entries.find((e) => e.home) : null;
    const items = home ? entries.filter((e) => e !== home) : entries;
    const logo = app.forum.attribute('logoUrl');
    const title = app.forum.attribute('title');
    const pos = c.position;
    const style = { ...vars };
    if (st.headerBg) style.background = st.headerBg;

    const link = (e, i) => (
      <div
        className={'CHS-HP-Item' + (e.kids.length ? ' has-kids' : '') + (this.dragFrom === e.srcIndex ? ' is-dragging' : '') + (this.dragOver === e.srcIndex && this.dragFrom !== e.srcIndex ? ' is-over' : '')}
        key={e.key + '-' + i}
        draggable={e.locked ? 'false' : 'true'}
        title={e.locked ? 'Kategoriler en sonda sabittir' : 'Sürükleyerek sağa / sola taşıyın'}
        ondragstart={(ev) => {
          if (e.locked) return ev.preventDefault();
          this.dragFrom = e.srcIndex;
          ev.dataTransfer.effectAllowed = 'move';
          try { ev.dataTransfer.setData('text/plain', String(e.srcIndex)); } catch (err) {}
        }}
        ondragover={(ev) => {
          if (e.locked || this.dragFrom == null) return;
          ev.preventDefault();
          this.dragOver = e.srcIndex;
        }}
        ondragleave={() => { if (this.dragOver === e.srcIndex) this.dragOver = null; }}
        ondrop={(ev) => {
          ev.preventDefault();
          this.reorder(c, save, this.dragFrom, e.srcIndex);
          this.dragFrom = this.dragOver = null;
        }}
        ondragend={() => { this.dragFrom = this.dragOver = null; }}
      >
        <a className="CHS-HP-Link" onclick={(ev) => ev.preventDefault()} href="#">
          {c.icons !== false ? <i className={'icon ' + e.icon}></i> : null}
          <span>{e.label}</span>
          {e.kids.length ? <i className="fas fa-chevron-down CHS-HP-Caret"></i> : null}
        </a>
        {e.kids.length ? (
          <div className="CHS-HP-Drop">
            {e.kids.map((k) => <a onclick={(ev) => ev.preventDefault()} href="#">{k.label || k.url || 'Alt öğe'}</a>)}
          </div>
        ) : null}
      </div>
    );

    const nav =
      pos === 'hamburger' ? (
        <div className={'CHS-HP-Burger' + (this.burgerOpen ? ' is-open' : '')}>
          <button type="button" className="CHS-HP-Link" onclick={() => (this.burgerOpen = !this.burgerOpen)}>
            <span className="CHS-HP-Lines"><span></span><span></span><span></span></span>
            {c.showLabel !== false ? <span>Menü</span> : null}
          </button>
          {this.burgerOpen ? (
            <div className="CHS-HP-Drop is-shown">
              {items.map((e) => (
                <a onclick={(ev) => ev.preventDefault()} href="#">
                  {c.icons !== false ? <i className={e.icon}></i> : null} {e.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="CHS-HP-Nav">{items.map(link)}</div>
      );

    return (
      <div className={'CHS-HPreview CHS-HPreview--' + this.previewWidth + ' ' + classes.join(' ')} style={style}>
        <div className="CHS-HP-Bar">
          {home ? (
            <a className="CHS-HP-Home" href="#" title={home.label} onclick={(ev) => ev.preventDefault()}>
              <i className={home.icon || 'fas fa-home'}></i>
            </a>
          ) : null}
          <div className="CHS-HP-Logo">{logo ? <img src={logo} alt="" /> : <strong>{title}</strong>}</div>
          {pos !== 'subheader' ? <div className={'CHS-HP-Primary CHS-HP-Primary--' + (pos === 'hamburger' ? 'left' : st.placement)}>{nav}</div> : <div className="CHS-HP-Primary"></div>}
          <div className="CHS-HP-Session">
            <i className="fas fa-search"></i>
            <i className="fas fa-bell"></i>
            <span className="CHS-HP-Avatar"></span>
          </div>
        </div>
        {pos === 'subheader' ? <div className={'CHS-HP-Sub CHS-HP-Sub--' + (c.align || 'center')}>{nav}</div> : null}
        <div className="CHS-HP-Page">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  }

  // ───────────────────────── Görünüm

  view(c, save) {
    c.style = c.style || {};
    const st = { ...HEADER_STYLE_DEFAULTS, ...c.style };
    const set = (k, v) => {
      if (v === '' || v === HEADER_STYLE_DEFAULTS[k]) delete c.style[k];
      else c.style[k] = v;
      save();
    };
    const sel = (key, options) => Select.component({ options, value: String(st[key]), onchange: (v) => set(key, isNaN(Number(v)) || typeof HEADER_STYLE_DEFAULTS[key] !== 'number' ? v : Number(v)) });
    const header = c.position === 'header';

    return (
      <div className="CHS-HS">
        <div className="CHS-HS-PreviewHead">
          <strong><i className="fas fa-eye"></i> Canlı önizleme</strong>
          <div className="CHS-HS-Widths">
            {[['desktop', 'fas fa-desktop', 'Geniş ekran'], ['laptop', 'fas fa-laptop', 'Dizüstü']].map(([k, icon, t]) => (
              <button type="button" title={t} className={this.previewWidth === k ? 'is-active' : ''} onclick={() => (this.previewWidth = k)}>
                <i className={icon}></i>
              </button>
            ))}
          </div>
        </div>
        {this.viewPreview(c, st, save)}
        <small className="CHS-HS-Note"><i className="fas fa-arrows-alt-h"></i> Önizlemedeki öğeleri <strong>sürükleyerek sağa / sola taşıyabilir</strong>, üzerine gelerek vurgu ve açılır kutuyu deneyebilirsiniz. Değişiklikler kaydedince forumda uygulanır.</small>

        <div className="CHS-HS-Grid">
          {this.group('fas fa-arrows-alt-h', 'Yerleşim', [
            header ? this.field('Header içindeki yeri', sel('placement', { left: 'Logonun yanında (sola yaslı)', center: 'Ortada', right: 'Sağda (kullanıcı alanının yanında)' })) : null,
            header ? this.field('Menüyü yatayda kaydır', this.slider(st, 'offset', -300, 300, 5, 'px', set), 'Eksi değer sola, artı değer sağa taşır.') : null,
            this.field('Öğeler arası boşluk', this.slider(st, 'gap', 0, 40, 1, 'px', set)),
            this.field('Öğe yüksekliği', this.slider(st, 'height', 28, 56, 1, 'px', set)),
            this.field('Yatay iç boşluk', this.slider(st, 'paddingX', 4, 28, 1, 'px', set)),
          ])}

          {this.group('fas fa-font', 'Yazı', [
            this.field('Yazı boyutu', this.slider(st, 'fontSize', 11, 20, 1, 'px', set)),
            this.field('Kalınlık', sel('fontWeight', { 400: 'Normal', 500: 'Orta', 600: 'Yarı kalın', 700: 'Kalın', 800: 'Çok kalın' })),
            this.field('Harf aralığı', this.slider(st, 'letterSpacing', 0, 3, 0.5, 'px', set)),
            <div className="CHS-HS-Field CHS-HS-Switch"><Switch state={!!st.uppercase} onchange={(v) => set('uppercase', v)}>BÜYÜK HARF</Switch></div>,
          ])}

          {this.group('fas fa-icons', 'İkonlar', [
            this.field('İkon ve yazı', sel('iconMode', { left: 'İkon solda, yazı yanında', top: 'İkon üstte, yazı altında', only: 'Yalnızca ikon (ad ipucu olarak)', none: 'Yalnızca yazı' })),
            this.field('İkon boyutu', this.slider(st, 'iconSize', 10, 26, 1, 'px', set)),
            this.field('İkon rengi', this.color(st, 'iconColor', set, 'Yazı rengiyle aynı')),
          ])}

          {this.group('fas fa-palette', 'Renkler', [
            this.field('Header zemini', this.color(st, 'headerBg', set, 'Temanın header rengi')),
            this.field('Yazı rengi', this.color(st, 'textColor', set, 'Temanın header yazı rengi')),
            this.field('Açılır kutu zemini', this.color(st, 'dropBg', set, 'Sayfa zemini')),
            this.field('Açılır kutu yazısı', this.color(st, 'dropColor', set, 'Sayfa yazı rengi')),
          ])}

          {this.group('fas fa-mouse-pointer', 'Üzerine gelince', [
            this.field('Vurgu biçimi', sel('hover', { pill: 'Yumuşak zemin', underline: 'Alt çizgi', color: 'Yalnızca renk', none: 'Vurgu yok' })),
            this.field('Vurgu rengi (yazı)', this.color(st, 'hoverColor', set, 'Yazı rengiyle aynı')),
            st.hover === 'pill' ? this.field('Vurgu zemini', this.color(st, 'hoverBg', set, 'Yarı saydam açık')) : null,
            st.hover === 'pill' ? this.field('Köşe yuvarlaklığı', this.slider(st, 'radius', 0, 24, 1, 'px', set)) : null,
          ])}

          {this.group('fas fa-home', 'Ana sayfa ikonu', [
            <div className="CHS-HS-Field CHS-HS-Switch"><Switch state={!!st.homeIcon} onchange={(v) => set('homeIcon', v)}>Ana Sayfa logonun solunda yalnızca ikon olsun</Switch></div>,
            st.homeIcon ? this.field('İkon alanı boyutu', this.slider(st, 'homeSize', 28, 52, 1, 'px', set)) : null,
            st.homeIcon ? this.field('Biçim', sel('homeShape', { circle: 'Yuvarlak', square: 'Köşeli', plain: 'Çerçevesiz' })) : null,
          ])}
        </div>

        <div className="CHS-HS-Actions">
          {Button.component(
            {
              className: 'Button',
              icon: 'fas fa-undo',
              onclick: () => {
                if (!confirm('Header görünümü varsayılana dönsün mü?')) return;
                c.style = {};
                save();
              },
            },
            'Görünümü Varsayılana Döndür'
          )}
        </div>
      </div>
    );
  }
}
