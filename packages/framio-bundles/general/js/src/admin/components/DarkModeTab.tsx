import app from 'flarum/admin/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';
import saveSettings from 'flarum/admin/utils/saveSettings';

/**
 * Karanlık Mod modülü ayarları. Hesaplar sunucudaki DarkModeStyles / ColorTools ile aynıdır;
 * burada yalnızca anlık önizleme için tekrarlanır.
 */
const DEFAULT_DARK_BG = '#1a1a1a';
const DEFAULTS = { bg: '#1a1a1a', surface: '#212121', text: '#dddddd', muted: '#a0a0a0' };

const hexToRgb = (hex) => {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const norm = (hex) => {
  const r = hexToRgb(hex);
  return r ? rgbToHex(r) : null;
};
const lum = (rgb) => {
  const c = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const rgbToHsl = ([r, g, b]) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
};
const hslToRgb = ([h, s, l]) => {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
};
const adapt = (hex, bgHex, target = 4.5) => {
  const rgb = hexToRgb(hex) || [128, 128, 128];
  const bg = hexToRgb(bgHex) || [26, 26, 26];
  if (contrast(rgb, bg) >= target) return { hex: rgbToHex(rgb), shift: 0, contrast: contrast(rgb, bg) };
  let [h, s, l] = rgbToHsl(rgb);
  const start = l;
  s = Math.min(s, 0.85);
  for (let step = l; step <= 0.95; step += 0.01) {
    const c = hslToRgb([h, s, step]);
    if (contrast(c, bg) >= target) return { hex: rgbToHex(c), shift: step - start, contrast: contrast(c, bg) };
  }
  const f = hslToRgb([h, s, 0.85]);
  return { hex: rgbToHex(f), shift: 0.85 - start, contrast: contrast(f, bg) };
};
const sat = (hex) => {
  const r = hexToRgb(hex);
  return r ? rgbToHsl(r)[1] : 0;
};

const MODES = [
  { key: 'auto', label: 'Otomatik', help: 'Birincil ve ikincil renkten en az değişeni ve renkli olanı seçip okunur tona açar.' },
  { key: 'primary', label: 'Birincil renk', help: 'Sitenin birincil renginin karanlıkta okunur tonu.' },
  { key: 'secondary', label: 'İkincil renk', help: 'Sitenin ikincil renginin karanlıkta okunur tonu.' },
  { key: 'custom', label: 'Özel renk', help: 'Kendi seçtiğiniz renk (olduğu gibi kullanılır).' },
  { key: 'off', label: 'Kapalı', help: 'Flarum varsayılanı: ana renk karanlıkta değişmez.' },
];

export default class DarkModeTab extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    const s = app.data.settings;
    const get = (k, d = '') => (s['framio-general.dm_' + k] ?? d) || d;

    this.mode = get('accent_mode', 'auto');
    this.custom = get('accent_custom', '');
    this.palette = get('palette', '0') === '1';
    this.bg = get('bg', '');
    this.surface = get('surface', '');
    this.text = get('text', '');
    this.muted = get('muted', '');
    this.compat = get('compat', '1') !== '0';
    this.headerFix = get('header_fix', '1') !== '0';
    this.userSwitch = get('user_switch', '1') !== '0';
    this.customCss = get('custom_css', '');
    this.saving = false;

    this.primary = norm(s.theme_primary_color) || '#4d698e';
    this.secondary = norm(s.theme_secondary_color) || this.primary;
  }

  darkBg() {
    return (this.palette && norm(this.bg)) || DEFAULT_DARK_BG;
  }

  /** Bir moda göre karanlık vurgu rengi (önizleme ve seçenek örnekleri için) */
  accentFor(mode) {
    const bg = this.darkBg();
    if (mode === 'off') return { hex: this.primary, source: 'off', contrast: contrast(hexToRgb(this.primary), hexToRgb(bg)) };
    if (mode === 'custom' && norm(this.custom)) return { hex: norm(this.custom), source: 'custom', contrast: contrast(hexToRgb(norm(this.custom)), hexToRgb(bg)) };
    if (mode === 'primary') return { ...adapt(this.primary, bg), source: 'primary' };
    if (mode === 'secondary') return { ...adapt(this.secondary, bg), source: 'secondary' };

    const p = adapt(this.primary, bg);
    const q = adapt(this.secondary, bg);
    const ps = p.shift + (sat(this.primary) < 0.15 ? 1 : 0);
    const qs = q.shift + (sat(this.secondary) < 0.15 ? 1 : 0);
    return qs < ps ? { ...q, source: 'secondary' } : { ...p, source: 'primary' };
  }

  save() {
    if (this.mode === 'custom' && !norm(this.custom)) {
      app.alerts.show({ type: 'error' }, 'Özel renk için geçerli bir renk kodu girin (örn. #e53935).');
      return;
    }
    this.saving = true;
    saveSettings({
      'framio-general.dm_accent_mode': this.mode,
      'framio-general.dm_accent_custom': norm(this.custom) || '',
      'framio-general.dm_palette': this.palette ? '1' : '0',
      'framio-general.dm_bg': norm(this.bg) || '',
      'framio-general.dm_surface': norm(this.surface) || '',
      'framio-general.dm_text': norm(this.text) || '',
      'framio-general.dm_muted': norm(this.muted) || '',
      'framio-general.dm_compat': this.compat ? '1' : '0',
      'framio-general.dm_header_fix': this.headerFix ? '1' : '0',
      'framio-general.dm_user_switch': this.userSwitch ? '1' : '0',
      'framio-general.dm_custom_css': this.customCss,
    })
      .then(() => {
        app.alerts.show({ type: 'success' }, 'Karanlık mod ayarları kaydedildi. Değişiklikler forumda sayfa yenilenince görünür.');
      })
      .finally(() => {
        this.saving = false;
        m.redraw();
      });
  }

  colorField(label, prop, placeholder, disabled = false) {
    const val = this[prop];
    const valid = norm(val);
    return (
      <div className="FramioDM-color">
        <label>{label}</label>
        <div className="FramioDM-colorRow">
          <input
            type="color"
            value={valid || placeholder}
            disabled={disabled}
            className={valid ? '' : 'is-empty'}
            oninput={(e) => {
              this[prop] = e.target.value;
            }}
          />
          <input
            type="text"
            className="FormControl"
            placeholder={placeholder}
            value={val}
            disabled={disabled}
            oninput={(e) => {
              this[prop] = e.target.value.trim();
            }}
          />
        </div>
      </div>
    );
  }

  preview(accent) {
    const bg = this.darkBg();
    const surface = (this.palette && norm(this.surface)) || DEFAULTS.surface;
    const text = (this.palette && norm(this.text)) || DEFAULTS.text;
    const muted = (this.palette && norm(this.muted)) || DEFAULTS.muted;
    const ok = accent.contrast >= 4.5;

    return (
      <div className="FramioDM-preview" style={{ background: bg, color: text }}>
        <div className="FramioDM-previewHead">
          <strong style={{ color: text }}>Karanlık tema önizlemesi</strong>
          <span className={'FramioDM-badge ' + (ok ? 'is-ok' : 'is-bad')}>
            Kontrast {accent.contrast.toFixed(2)} {ok ? '✓' : '— zayıf'}
          </span>
        </div>
        <div className="FramioDM-tabs">
          <span style={{ color: accent.hex, borderColor: accent.hex }}>Gönderiler 493</span>
          <span style={{ color: muted }}>Konular</span>
          <span style={{ color: muted }}>Beğeniler</span>
        </div>
        <div className="FramioDM-card" style={{ background: surface }}>
          <div style={{ color: text, fontWeight: 700 }}>Nostalji Otobüsler</div>
          <div style={{ color: muted, fontSize: '12px' }}>dorukkirbay · 3 saat önce</div>
          <p style={{ color: text }}>
            Künye: <a style={{ color: accent.hex }}>Mercedes-Benz Travego 15 SHD</a> · <a style={{ color: accent.hex }}>34 CDL 37</a>
          </p>
        </div>
        <div className="FramioDM-chips">
          {['Mercedes-Benz 669', 'MAN 266', 'Temsa 144'].map((t) => (
            <span style={{ background: surface, color: text }}>{t}</span>
          ))}
        </div>
      </div>
    );
  }

  view() {
    const accent = this.accentFor(this.mode);
    const sourceLabel = { primary: 'birincil renkten', secondary: 'ikincil renkten', custom: 'özel renk', off: 'Flarum varsayılanı' }[accent.source];

    return (
      <div className="container FramioDM">
        <h2>Karanlık Mod</h2>
        <p className="helpText">
          Flarum'un karanlık temasında okunmayan yazıları ve karanlığa geçmeyen alanları düzeltir. Ayarlar yalnızca karanlık temada uygulanır; açık tema
          etkilenmez.
        </p>

        <section className="FramioDM-section">
          <h3>1. Vurgu rengi</h3>
          <p className="helpText">
            Flarum ana rengi karanlık temada değiştirmez; koyu ana renkli sitelerde bağlantılar, aktif sekmeler ve vurgulu yazılar kaybolur. Burada seçilen
            ton yalnızca karanlıkta ana renk ve bağlantı rengi olarak kullanılır. Sitenin birincil rengi <code>{this.primary}</code>, ikincil rengi{' '}
            <code>{this.secondary}</code>.
          </p>

          <div className="FramioDM-modes">
            {MODES.map((mo) => {
              const a = this.accentFor(mo.key);
              const on = this.mode === mo.key;
              return (
                <button type="button" className={'FramioDM-mode' + (on ? ' is-on' : '')} onclick={() => (this.mode = mo.key)} aria-pressed={on ? 'true' : 'false'}>
                  <span className="FramioDM-swatch" style={{ background: mo.key === 'custom' && !norm(this.custom) ? 'transparent' : a.hex }} />
                  <span className="FramioDM-modeText">
                    <strong>{mo.label}</strong>
                    <small>{mo.help}</small>
                  </span>
                  {mo.key !== 'custom' || norm(this.custom) ? <code>{a.hex}</code> : null}
                </button>
              );
            })}
          </div>

          {this.mode === 'custom' ? this.colorField('Özel vurgu rengi', 'custom', '#e53935') : null}

          <p className="helpText">
            Seçili: <code>{accent.hex}</code> ({sourceLabel}). Kontrast hedefi en az 4,5'tir.
          </p>
        </section>

        <section className="FramioDM-section">
          <h3>2. Karanlık mod paleti (isteğe bağlı)</h3>
          <div className="Form-group">
            <Switch state={this.palette} onchange={(v) => (this.palette = v)}>
              Flarum'un karanlık renkleri yerine bu paleti kullan
            </Switch>
          </div>
          <div className="FramioDM-grid">
            {this.colorField('Sayfa zemini', 'bg', DEFAULTS.bg, !this.palette)}
            {this.colorField('Kart / kontrol zemini', 'surface', DEFAULTS.surface, !this.palette)}
            {this.colorField('Metin', 'text', DEFAULTS.text, !this.palette)}
            {this.colorField('Soluk metin', 'muted', DEFAULTS.muted, !this.palette)}
          </div>
        </section>

        <section className="FramioDM-section">
          <h3>Kullanıcı tema seçimi</h3>
          <Switch state={this.userSwitch} onchange={(v) => (this.userSwitch = v)}>
            Üyeler ve ziyaretçiler, forumun renk şeması ne olursa olsun açık/karanlık tema arasında geçiş yapabilsin
          </Switch>
          <p className="helpText">
            Flarum tema geçiş ikonunu ve ayarlar sayfasındaki tema seçimini yalnızca Görünüm → Renk Şeması "Otomatik" iken gösterir. Bu seçenek
            açıkken forumun renk şeması yalnızca varsayılan tema olur; kendi tercihini yapan kullanıcıya onun seçimi uygulanır.
          </p>
        </section>

        <section className="FramioDM-section">
          <h3>3. Renkli başlık düzeltmesi</h3>
          <Switch state={this.headerFix} onchange={(v) => (this.headerFix = v)}>
            Karanlık temada başlık yazılarını ve ikonlarını başlık zeminine göre okunur yap
          </Switch>
          <p className="helpText">
            Flarum karanlık temada renkli başlığın zeminini ana renk, yazılarını ise karanlık zemin rengi yapar; koyu ana renkli sitelerde başlıktaki
            menü, arama ve ikonlar görünmez olur. Yalnızca "Renkli başlık" açıkken uygulanır.
          </p>
        </section>

        <section className="FramioDM-section">
          <h3>4. Otomatik uyumluluk katmanı</h3>
          <Switch state={this.compat} onchange={(v) => (this.compat = v)}>
            Eklentilerin sabit açık renklerini karanlıkta tema renklerine çevir
          </Switch>
          <p className="helpText">
            Eklenti pencerelerinde ve kartlarda doğrudan yazılmış beyaz/açık gri zeminleri, koyu yazıları ve açık kenarlıkları karanlık temaya uyarlar.
            Kaynak kodlar tek tek düzeltilene kadar güvenlik ağı olarak açık kalması önerilir.
          </p>
        </section>

        <section className="FramioDM-section">
          <h3>5. Karanlık moda özel CSS</h3>
          <textarea
            className="FormControl FramioDM-css"
            rows="6"
            placeholder={'.Benim-Kartim { background: var(--control-bg); }\n.Benim-Basligim { color: var(--text-color); }'}
            value={this.customCss}
            oninput={(e) => (this.customCss = e.target.value)}
          />
          <p className="helpText">Yazdığınız kurallar otomatik olarak yalnızca karanlık temada uygulanır.</p>
        </section>

        {this.preview(accent)}

        <Button className="Button Button--primary" loading={this.saving} onclick={() => this.save()}>
          Kaydet
        </Button>
      </div>
    );
  }
}
