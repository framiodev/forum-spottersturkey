import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';
import Select from 'flarum/common/components/Select';
import HeaderStyleEditor from './HeaderStyleEditor';

/**
 * Menü Yöneticisi sekmesi: ana menünün (yatay üst satır + dikey kenar menüsü)
 * öğeleri, sırası, adları, ikonları, nerede görüneceği; kategoriler bloğu ve
 * "Bir Tartışma Başlat" düğmesi.
 *
 * framio-custom-homepage.nav_menu            JSON dizi, sıra = menü sırası
 * framio-custom-homepage.nav_new_discussion  JSON nesne
 */

const KEY = 'framio-custom-homepage.nav_menu';
const ND_KEY = 'framio-custom-homepage.nav_new_discussion';
const CATEGORY_KEY = '__categories';
const isTagKey = (k) => /^tag\d+$/.test(k) || k === 'separator' || k === 'moreTags';

function parse(v, fallback) {
  try {
    const x = JSON.parse(v || '');
    return x == null ? fallback : x;
  } catch (e) {
    return fallback;
  }
}

const MODES = {
  inline: 'Satır satır (forumun varsayılanı)',
  collapsible: 'Açılır-kapanır (alt kategoriler üst kategorinin altında)',
  dropdown: 'Tek açılır menü ("Kategoriler" düğmesi)',
};

export default class MenuManager {
  constructor(page) {
    this.page = page;
    this.setting = page.setting(KEY, '[]');
    this.ndSetting = page.setting(ND_KEY, '{}');
    this.discovered = parse(app.forum.attribute('framioNavDiscovered'), []);
    this.nd = parse(this.ndSetting(), {}) || {};
    this.dragIndex = null;
    this.expanded = null;

    let items = parse(this.setting(), []);
    // Eski kayıt: kategoriler tek tek (tagN) kaydedilmişse tek bloğa dönüştür
    if (items.some((i) => isTagKey(i.key))) {
      items = items.filter((i) => !isTagKey(i.key));
      if (!items.some((i) => i.key === CATEGORY_KEY)) items.push(this.categoryEntry());
      this.items = items;
      this.sync();
    } else {
      this.items = items;
    }

    // İlk açılış: forumda bulunan öğelerle, forumdaki sırayla başla (kaydedilene kadar değişmez)
    if (!this.items.length && this.discovered.length) {
      this.items = this.discovered.map((d) => (d.key === CATEGORY_KEY ? this.categoryEntry() : this.entry(d.key)));
      this.prefilled = true;
    }
    // Forumda olup listede olmayan öğeler (sonradan kurulan eklentiler) sona eklenir;
    // kaldırmak yerine anahtarla gizlenir
    this.discovered.forEach((d) => {
      if (this.items.some((i) => i.key === d.key)) return;
      this.items.push(d.key === CATEGORY_KEY ? this.categoryEntry() : this.entry(d.key));
      this.appended = true;
    });
    if (!this.items.some((i) => i.key === CATEGORY_KEY) && app.store.all('tags').length) this.items.push(this.categoryEntry());
    this.normalize();
  }

  /** Kategoriler bloğu her zaman menünün en sonunda */
  normalize() {
    const cat = this.items.find((i) => i.key === CATEGORY_KEY);
    this.items = this.items.filter((i) => i.key !== CATEGORY_KEY).concat(cat ? [cat] : []);
  }

  /** Sıralanabilir son satırın sırası (kategorilerden önceki) */
  lastMovable() {
    return this.items.filter((i) => i.key !== CATEGORY_KEY).length - 1;
  }

  entry(key) {
    return { key, label: '', icon: '', top: true, side: true, hidden: false };
  }

  categoryEntry() {
    return { key: CATEGORY_KEY, label: 'Kategoriler', icon: 'fas fa-tags', top: true, side: true, hidden: false, mode: 'inline', hiddenTags: [] };
  }

  sync() {
    this.normalize();
    this.setting(JSON.stringify(this.items));
    this.prefilled = false;
  }

  syncNd() {
    this.ndSetting(JSON.stringify(this.nd));
  }

  defaults(key) {
    if (key === CATEGORY_KEY) return { label: 'Kategoriler', icon: 'fas fa-tags' };
    return this.discovered.find((d) => d.key === key) || {};
  }

  move(from, to) {
    if (to < 0 || to > this.lastMovable() || from > this.lastMovable() || from === to) return;
    const [x] = this.items.splice(from, 1);
    this.items.splice(to, 0, x);
    this.sync();
  }

  add(entry) {
    this.items.push(entry);
    this.sync(); // normalize: kategoriler yine en sonda
  }

  remove(i) {
    this.items.splice(i, 1);
    this.sync();
  }

  // ───────────────────────── Görünüm

  view() {
    const p = this.page;
    const missing = this.discovered.filter((d) => !this.items.some((i) => i.key === d.key));

    return [
      this.viewHeaderPlacement(),

      p.card(
        'fas fa-bars',
        'Menü Öğeleri',
        'Ana sayfadaki yatay menü ile diğer sayfalardaki sol menü aynı listedir. "Bir Tartışma Başlat" düğmesi en başta, kategoriler en sonda sabittir; aradaki öğeleri sürükleyerek veya oklarla sıralayın.',
        <div className="CHS-Menu">
          {this.appended && !this.prefilled ? (
            <div className="CHS-Menu-Note">
              <i className="fas fa-info-circle"></i> Forumda bulunan yeni menü öğeleri listenin sonuna eklendi. Sıralayıp kaydedin.
            </div>
          ) : null}
          {this.prefilled ? (
            <div className="CHS-Menu-Note">
              <i className="fas fa-info-circle"></i> Liste forumdaki mevcut menüden oluşturuldu. Bir değişiklik yapıp kaydedene kadar forum eski düzeniyle kalır.
            </div>
          ) : null}
          {!this.items.length ? (
            <div className="CHS-Menu-Note">
              <i className="fas fa-info-circle"></i> Henüz öğe yok. Forumu yönetici hesabıyla bir kez açın; menüdeki bütün öğeler buraya kendiliğinden gelir. Özel bağlantı da ekleyebilirsiniz.
            </div>
          ) : null}
          <div className="CHS-Menu-List">
            {/* Tek dizi: bütün satırlar anahtarlı (Mithril karışık anahtar kabul etmez) */}
            {[this.viewNewDiscussionRow(), ...this.items.map((it, i) => (it.key === CATEGORY_KEY ? this.viewCategoryRow(it) : this.viewRow(it, i)))]}
          </div>
          <div className="CHS-Menu-Actions">
            {Button.component(
              {
                className: 'Button',
                icon: 'fas fa-plus',
                onclick: () => {
                  this.add({ key: 'framio-custom-' + Date.now(), custom: true, label: '', url: '', icon: 'fas fa-link', newTab: false, top: true, side: true, hidden: false });
                  this.expanded = this.lastMovable();
                },
              },
              'Özel Bağlantı Ekle'
            )}
            {this.items.length
              ? Button.component(
                  {
                    className: 'Button Button--danger',
                    icon: 'fas fa-undo',
                    onclick: () => {
                      if (!confirm('Menü yapılandırması sıfırlansın mı? Forum varsayılan menüye döner.')) return;
                      this.items = [];
                      this.sync();
                    },
                  },
                  'Varsayılana Dön'
                )
              : null}
          </div>
        </div>
      ),

      missing.length
        ? p.card(
            'fas fa-puzzle-piece',
            'Listede Olmayan Öğeler',
            'Forumda bulunan ama listenize eklenmemiş öğeler. Eklenmeyenler varsayılan yerlerinde görünmeye devam eder.',
            <div className="CHS-Menu-Missing">
              {missing.map((d) => (
                <button className="CHS-Menu-Chip" onclick={() => this.add(d.key === CATEGORY_KEY ? this.categoryEntry() : this.entry(d.key))}>
                  <i className={d.icon || 'fas fa-circle'}></i> {d.label} <i className="fas fa-plus"></i>
                </button>
              ))}
            </div>
          )
        : null,

      p.card('fas fa-eye', 'Önizleme', 'Kaydedince forumda görünecek sıra (gizli öğeler hariç).', this.viewPreview()),
    ];
  }

  /** Yatay menünün yeri: sayfada / header içinde / header altında şerit / ☰ açılır menü */
  viewHeaderPlacement() {
    const s = this.page.setting('framio-custom-homepage.nav_header', '{}');
    if (!this.hc) {
      let c = {};
      try {
        c = JSON.parse(s() || '{}') || {};
      } catch (e) {}
      this.hc = { position: 'page', align: 'center', icons: true, allPages: true, showLabel: true, source: 'same', items: [], ...c };
    }
    const c = this.hc;
    const save = () => s(JSON.stringify(c));
    const set = (k, v) => {
      c[k] = v;
      save();
    };
    const opt = (value, icon, title, desc) => (
      <button type="button" className={'CHS-Place' + (c.position === value ? ' is-active' : '')} onclick={() => set('position', value)}>
        <span className="CHS-Place-Sketch">
          <i className={icon}></i>
        </span>
        <strong>{title}</strong>
        <small>{desc}</small>
      </button>
    );
    const inHeader = c.position !== 'page';

    return this.page.card(
      'fas fa-window-maximize',
      'Yatay Menü Konumu ve Header Menüsü',
      'Ana sayfadaki yatay menüyü sayfada bırakın ya da header\'a taşıyın. Header menüsü her sayfada (ana sayfa, tartışmalar, profiller) aynı görünür.',
      <div>
        <div className="CHS-Place-Grid">
          {opt('page', 'fas fa-grip-lines', 'Sayfada', 'Mevcut hâli: içerik alanının üstünde ortalı menü')}
          {opt('header', 'fas fa-heading', 'Header içinde', 'Logonun yanında düzenli bir menü çubuğu')}
          {opt('subheader', 'fas fa-window-minimize', 'Header altında şerit', 'Header\'ın hemen altında tam genişlik navbar')}
          {opt('hamburger', 'fas fa-bars', '☰ Açılır menü', 'Logonun yanında üç çizgi; tıklayınca menü açılır')}
        </div>

        {inHeader ? (
          <div className="CHS-Menu-Body CHS-Menu-Body--flat" style={{ marginTop: '16px' }}>
            {c.position === 'subheader' ? (
              <div className="CHS-Menu-Field">
                <label>Hizalama</label>
                {Select.component({ options: { center: 'Ortada', left: 'Solda', right: 'Sağda' }, value: c.align, onchange: (v) => set('align', v) })}
              </div>
            ) : null}
            <div className="CHS-Menu-Field CHS-Menu-Inline CHS-Menu-Switches">
              <Switch state={c.icons !== false} onchange={(v) => set('icons', v)}>İkonları göster</Switch>
              {c.position === 'hamburger' ? <Switch state={c.showLabel !== false} onchange={(v) => set('showLabel', v)}>Çizgilerin yanında "Menü" yazsın</Switch> : null}
              <Switch state={!!c.allPages} onchange={(v) => set('allPages', v)}>Tüm sayfalarda göster</Switch>
            </div>

            <div className="CHS-Menu-Field" style={{ gridColumn: '1 / -1' }}>
              <label>Header menüsünün içeriği</label>
              <div className="CHS-Source">
                <label className={c.source !== 'custom' ? 'is-active' : ''}>
                  <input type="radio" checked={c.source !== 'custom'} onchange={() => set('source', 'same')} />
                  <span><strong>Menü Öğeleri ile aynı</strong><small>Aşağıdaki listede "Yatay" işaretli öğeler ve alt öğeleri</small></span>
                </label>
                <label className={c.source === 'custom' ? 'is-active' : ''}>
                  <input type="radio" checked={c.source === 'custom'} onchange={() => {
                    // İlk geçişte mevcut yatay menüyle başla
                    if (!c.items || !c.items.length) c.items = this.items.filter((i) => i.top !== false && !i.hidden).map((i) => JSON.parse(JSON.stringify(i)));
                    set('source', 'custom');
                  }} />
                  <span><strong>Ayrı liste</strong><small>Header menüsünü sayfadaki menüden bağımsız düzenleyin</small></span>
                </label>
              </div>
            </div>

            {c.source === 'custom' ? <div style={{ gridColumn: '1 / -1' }}>{this.headerListEditor(c, save)}</div> : null}

            <div className="CHS-Menu-Field" style={{ gridColumn: '1 / -1' }}>
              <label>Header görünümü</label>
              {(this.styleEditor || (this.styleEditor = new HeaderStyleEditor(this))).view(c, save)}
            </div>

            <small className="CHS-Place-Note">Telefonda header menüsü gösterilmez; menü sayfada ve Flarum'un yan çekmecesinde kalır.</small>
          </div>
        ) : null}
      </div>
    );
  }

  /** Header için ayrı liste düzenleyicisi */
  headerListEditor(c, save) {
    const list = (c.items = c.items || []);
    const options = { custom: 'Özel bağlantı' };
    this.discovered.forEach((d) => (options[d.key] = d.label));
    options[CATEGORY_KEY] = 'Kategoriler (açılır liste)';
    const move = (from, to) => {
      if (to < 0 || to >= list.length) return;
      const [x] = list.splice(from, 1);
      list.splice(to, 0, x);
      save();
    };

    return (
      <div className="CHS-HList">
        {list.map((it, i) => {
          const def = this.defaults(it.key);
          const type = it.custom ? 'custom' : it.key;
          const set = (k, v) => {
            it[k] = v;
            save();
          };
          return (
            <div className={'CHS-HList-Row' + (it.hidden ? ' is-off' : '')} key={it.key + '-' + i}>
              <div className="CHS-HList-Main">
                <span className="CHS-Menu-Icon"><i className={it.icon || def.icon || (it.custom ? 'fas fa-link' : 'fas fa-circle')}></i></span>
                {Select.component({
                  options,
                  value: type,
                  onchange: (v) => {
                    if (v === 'custom') list[i] = { key: 'framio-custom-' + Date.now(), custom: true, label: it.label || '', url: '', icon: '', children: it.children || [] };
                    else list[i] = { key: v, label: '', icon: '', children: it.children || [] };
                    save();
                  },
                })}
                <input className="FormControl" placeholder={def.label || 'Görünen ad'} value={it.label || ''} oninput={(e) => set('label', e.target.value)} />
                <input className="FormControl CHS-HList-Icon" placeholder={def.icon || 'fas fa-...'} value={it.icon || ''} oninput={(e) => set('icon', e.target.value.trim())} />
                {it.custom ? <input className="FormControl" placeholder="/yol veya https://..." value={it.url || ''} oninput={(e) => set('url', e.target.value.trim())} /> : null}
                <Switch state={!it.hidden} onchange={(v) => set('hidden', !v)} />
                <div className="CHS-Menu-Order">
                  <button disabled={i === 0} onclick={() => move(i, i - 1)}><i className="fas fa-chevron-up"></i></button>
                  <button disabled={i === list.length - 1} onclick={() => move(i, i + 1)}><i className="fas fa-chevron-down"></i></button>
                </div>
                <button className="CHS-Menu-Edit" title="Sil" onclick={() => { list.splice(i, 1); save(); }}><i className="fas fa-trash"></i></button>
              </div>
              {it.key !== CATEGORY_KEY ? this.childrenEditor(it, save) : <small className="CHS-HList-Hint">Kategoriler, Menü Öğeleri'ndeki kategori ayarlarına göre alt liste olarak açılır.</small>}
            </div>
          );
        })}
        {Button.component({ className: 'Button', icon: 'fas fa-plus', onclick: () => { list.push({ key: 'framio-custom-' + Date.now(), custom: true, label: '', url: '', icon: '', children: [] }); save(); } }, 'Öğe Ekle')}
      </div>
    );
  }

  /** Bir öğenin alt öğeleri: [{ label, url, icon, newTab, hidden }] */
  childrenEditor(it, save) {
    const kids = (it.children = it.children || []);
    const move = (from, to) => {
      if (to < 0 || to >= kids.length) return;
      const [x] = kids.splice(from, 1);
      kids.splice(to, 0, x);
      save();
    };
    return (
      <div className="CHS-Kids">
        <div className="CHS-Kids-Head">
          <span><i className="fas fa-level-down-alt"></i> Alt öğeler {kids.length ? `(${kids.length})` : ''}</span>
          <button type="button" className="Button Button--link" onclick={() => { kids.push({ label: '', url: '', icon: '', newTab: false }); save(); }}>
            <i className="fas fa-plus"></i> Alt öğe ekle
          </button>
        </div>
        {kids.map((k, j) => {
          const set = (key, v) => {
            k[key] = v;
            save();
          };
          return (
            <div className={'CHS-Kids-Row' + (k.hidden ? ' is-off' : '')} key={j}>
              <span className="CHS-Kids-Arrow">↳</span>
              <input className="FormControl" placeholder="Ad" value={k.label || ''} oninput={(e) => set('label', e.target.value)} />
              <input className="FormControl" placeholder="/yol veya https://..." value={k.url || ''} oninput={(e) => set('url', e.target.value.trim())} />
              <input className="FormControl CHS-HList-Icon" placeholder="fas fa-..." value={k.icon || ''} oninput={(e) => set('icon', e.target.value.trim())} />
              <label className="CHS-Kids-Tab" title="Yeni sekmede aç"><input type="checkbox" checked={!!k.newTab} onchange={(e) => set('newTab', e.target.checked)} /> <i className="fas fa-external-link-alt"></i></label>
              <div className="CHS-Menu-Order">
                <button disabled={j === 0} onclick={() => move(j, j - 1)}><i className="fas fa-chevron-up"></i></button>
                <button disabled={j === kids.length - 1} onclick={() => move(j, j + 1)}><i className="fas fa-chevron-down"></i></button>
              </div>
              <button className="CHS-Kids-Del" title="Sil" onclick={() => { kids.splice(j, 1); save(); }}><i className="fas fa-times"></i></button>
            </div>
          );
        })}
      </div>
    );
  }

  /** "Bir Tartışma Başlat" düğmesi: listenin başında sabit satır */
  viewNewDiscussionRow() {
    const nd = this.nd;
    const set = (k, v) => {
      nd[k] = v;
      this.syncNd();
    };
    const open = this.expanded === 'nd';
    const off = nd.hidden || (nd.top === false && nd.side === false);
    return (
      <div className={'CHS-Menu-Row is-pinned' + (off ? ' is-off' : '')} key="__newDiscussion">
        <div className="CHS-Menu-Head">
          <span className="CHS-Menu-Grip is-locked" title="Sabit: menünün başında"><i className="fas fa-thumbtack"></i></span>
          <span className="CHS-Menu-Icon is-primary"><i className={nd.icon || 'fas fa-edit'}></i></span>
          <div className="CHS-Menu-Title">
            <strong>{nd.label || 'Bir Tartışma Başlat'}</strong>
            <small>Birincil düğme · menünün başında sabit</small>
          </div>
          <div className="CHS-Menu-Where">
            <label title="Ana sayfadaki yatay menüde göster"><input type="checkbox" checked={nd.top !== false} onchange={(e) => set('top', e.target.checked)} /> Yatay</label>
            <label title="Diğer sayfalardaki sol menüde göster"><input type="checkbox" checked={nd.side !== false} onchange={(e) => set('side', e.target.checked)} /> Dikey</label>
          </div>
          <Switch state={!nd.hidden} onchange={(v) => set('hidden', !v)} />
          <div className="CHS-Menu-Order is-placeholder"></div>
          <button className="CHS-Menu-Edit" title="Düzenle" onclick={() => (this.expanded = open ? null : 'nd')}>
            <i className={open ? 'fas fa-chevron-up' : 'fas fa-pen'}></i>
          </button>
        </div>
        {open ? (
          <div className="CHS-Menu-Body">
            <div className="CHS-Menu-Field">
              <label>Görünen ad</label>
              <input className="FormControl" placeholder="Bir Tartışma Başlat" value={nd.label || ''} oninput={(e) => set('label', e.target.value)} />
            </div>
            <div className="CHS-Menu-Field">
              <label>İkon (Font Awesome sınıfı)</label>
              <div className="CHS-Menu-IconInput">
                <span><i className={nd.icon || 'fas fa-edit'}></i></span>
                <input className="FormControl" placeholder="fas fa-edit" value={nd.icon || ''} oninput={(e) => set('icon', e.target.value.trim())} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /** Kategoriler: en sonda sabit, ayarları ve kategori ağacı her zaman açık */
  viewCategoryRow(it) {
    const off = it.hidden || (it.top === false && it.side === false);
    const set = (k, v) => {
      it[k] = v;
      this.sync();
    };
    return (
      <div className={'CHS-Menu-Row is-group is-pinned' + (off ? ' is-off' : '')} key={CATEGORY_KEY}>
        <div className="CHS-Menu-Head">
          <span className="CHS-Menu-Grip is-locked" title="Sabit: menünün sonunda"><i className="fas fa-thumbtack"></i></span>
          <span className="CHS-Menu-Icon"><i className="fas fa-tags"></i></span>
          <div className="CHS-Menu-Title">
            <strong>Kategoriler</strong>
            <small>{MODES[it.mode || 'inline']} · menünün sonunda sabit</small>
          </div>
          <div className="CHS-Menu-Where">
            <label title="Ana sayfadaki yatay menüde göster"><input type="checkbox" checked={it.top !== false} onchange={(e) => set('top', e.target.checked)} /> Yatay</label>
            <label title="Diğer sayfalardaki sol menüde göster"><input type="checkbox" checked={it.side !== false} onchange={(e) => set('side', e.target.checked)} /> Dikey</label>
          </div>
          <Switch state={!it.hidden} onchange={(v) => set('hidden', !v)} />
          <div className="CHS-Menu-Order is-placeholder"></div>
          <span className="CHS-Menu-Edit is-placeholder"></span>
        </div>
        {this.viewCategoryBody(it, set)}
      </div>
    );
  }
  viewRow(it, i) {
    const def = this.defaults(it.key);
    const isCat = it.key === CATEGORY_KEY;
    const label = isCat ? 'Kategoriler' : it.label || def.label || (it.custom ? 'Özel bağlantı' : it.key);
    const iconName = isCat ? 'fas fa-tags' : it.icon || def.icon || (it.custom ? 'fas fa-link' : 'fas fa-circle');
    const open = this.expanded === i;
    const off = it.hidden || (it.top === false && it.side === false);
    const set = (k, v) => {
      it[k] = v;
      this.sync();
    };
    const sub = isCat ? MODES[it.mode || 'inline'] : it.custom ? it.url || 'bağlantı girilmedi' : it.key;

    return (
      <div
        className={'CHS-Menu-Row' + (off ? ' is-off' : '') + (isCat ? ' is-group' : '') + (this.dragIndex === i ? ' is-dragging' : '')}
        key={it.key}
        draggable="true"
        ondragstart={(e) => {
          this.dragIndex = i;
          e.dataTransfer.effectAllowed = 'move';
        }}
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => {
          e.preventDefault();
          if (this.dragIndex !== null) this.move(this.dragIndex, i);
          this.dragIndex = null;
        }}
        ondragend={() => (this.dragIndex = null)}
      >
        <div className="CHS-Menu-Head">
          <span className="CHS-Menu-Grip" title="Sürükleyin"><i className="fas fa-grip-vertical"></i></span>
          <span className="CHS-Menu-Icon"><i className={iconName}></i></span>
          <div className="CHS-Menu-Title">
            <strong>{label}</strong>
            <small>{sub}</small>
          </div>
          <div className="CHS-Menu-Where">
            <label title="Ana sayfadaki yatay menüde göster">
              <input type="checkbox" checked={it.top !== false} onchange={(e) => set('top', e.target.checked)} /> Yatay
            </label>
            <label title="Diğer sayfalardaki sol menüde göster">
              <input type="checkbox" checked={it.side !== false} onchange={(e) => set('side', e.target.checked)} /> Dikey
            </label>
          </div>
          <Switch state={!it.hidden} onchange={(v) => set('hidden', !v)} />
          <div className="CHS-Menu-Order">
            <button title="Yukarı" disabled={i === 0} onclick={() => this.move(i, i - 1)}><i className="fas fa-chevron-up"></i></button>
            <button title="Aşağı" disabled={i >= this.lastMovable()} onclick={() => this.move(i, i + 1)}><i className="fas fa-chevron-down"></i></button>
          </div>
          <button className="CHS-Menu-Edit" title="Düzenle" onclick={() => (this.expanded = open ? null : i)}>
            <i className={open ? 'fas fa-chevron-up' : 'fas fa-pen'}></i>
          </button>
        </div>

        {open ? this.viewItemBody(it, i, def, iconName, set) : null}
      </div>
    );
  }

  viewItemBody(it, i, def, iconName, set) {
    return (
      <div className="CHS-Menu-Body">
        <div className="CHS-Menu-Field">
          <label>Görünen ad</label>
          <input className="FormControl" placeholder={def.label || 'Menüde görünecek ad'} value={it.label || ''} oninput={(e) => set('label', e.target.value)} />
        </div>
        <div className="CHS-Menu-Field">
          <label>İkon (Font Awesome sınıfı)</label>
          <div className="CHS-Menu-IconInput">
            <span><i className={iconName}></i></span>
            <input className="FormControl" placeholder={def.icon || 'örn. fas fa-home'} value={it.icon || ''} oninput={(e) => set('icon', e.target.value.trim())} />
          </div>
          <small>
            <a href="https://fontawesome.com/search?o=r&m=free" target="_blank" rel="noopener">Font Awesome</a> üzerinden ikon adını kopyalayın (ör. <code>fas fa-camera</code>). Boşsa varsayılan ikon kullanılır.
          </small>
        </div>
        {it.custom ? [
          <div className="CHS-Menu-Field">
            <label>Bağlantı</label>
            <input className="FormControl" placeholder="/d/123-konu veya https://..." value={it.url || ''} oninput={(e) => set('url', e.target.value.trim())} />
            <small>"/" ile başlayan adresler bu sitenin içidir.</small>
          </div>,
          <div className="CHS-Menu-Field CHS-Menu-Inline">
            <Switch state={!!it.newTab} onchange={(v) => set('newTab', v)}>Yeni sekmede aç</Switch>
            {Button.component({ className: 'Button Button--danger', icon: 'fas fa-trash', onclick: () => { this.remove(i); this.expanded = null; } }, 'Bağlantıyı Sil')}
          </div>,
        ] : (
          <div className="CHS-Menu-Field CHS-Menu-Inline">
            <small>Öğeyi menüden kaldırmak için satırdaki anahtarı kapatın.</small>
          </div>
        )}
        <div style={{ gridColumn: '1 / -1' }}>{this.childrenEditor(it, () => this.sync())}</div>
      </div>
    );
  }

  /** Kategoriler bloğu: görünüm biçimi ve kategori ağacı (alt kategoriler üstünün altında) */
  viewCategoryBody(it, set) {
    const hidden = (it.hiddenTags || []).map(String);
    const tags = app.store.all('tags').filter((t) => t.position() !== null);
    const parentOf = (t) => (t.parent && t.parent() ? t.parent() : null);
    const byPos = (a, b) => (a.position() || 0) - (b.position() || 0);
    const tops = tags.filter((t) => !parentOf(t)).sort(byPos);
    const toggleTag = (t) => {
      const id = String(t.id());
      const next = hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
      set('hiddenTags', next);
    };
    const tagRow = (t, child) => {
      const on = !hidden.includes(String(t.id()));
      return (
        <label className={'CHS-Menu-Tag' + (child ? ' is-child' : '') + (on ? '' : ' is-off')}>
          <input type="checkbox" checked={on} onchange={() => toggleTag(t)} />
          {child ? <span className="CHS-Menu-TagArrow">↳</span> : null}
          <i className={t.icon() || 'fas fa-tag'} style={{ color: t.color() || undefined }}></i>
          <span>{t.name()}</span>
        </label>
      );
    };

    return (
      <div className="CHS-Menu-Body">
        <div className="CHS-Menu-Field" style={{ gridColumn: '1 / -1' }}>
          <label>Görünüm biçimi</label>
          {Select.component({ options: MODES, value: it.mode || 'inline', onchange: (v) => set('mode', v) })}
          <small>
            {it.mode === 'collapsible'
              ? 'Üst kategoriler listelenir; alt kategoriler oka basınca açılır. Bulunulan kategori kendiliğinden açık gelir.'
              : it.mode === 'dropdown'
              ? 'Menüde tek bir "Kategoriler" düğmesi olur; tıklayınca tüm kategoriler (alt kategoriler girintili) açılır.'
              : 'Forumun varsayılan davranışı: alt kategoriler yalnızca o kategorinin içindeyken görünür.'}
          </small>
        </div>
        {it.mode === 'dropdown' ? [
          <div className="CHS-Menu-Field">
            <label>Düğme adı</label>
            <input className="FormControl" placeholder="Kategoriler" value={it.label || ''} oninput={(e) => set('label', e.target.value)} />
          </div>,
          <div className="CHS-Menu-Field">
            <label>Düğme ikonu</label>
            <div className="CHS-Menu-IconInput">
              <span><i className={it.icon || 'fas fa-tags'}></i></span>
              <input className="FormControl" placeholder="fas fa-tags" value={it.icon || ''} oninput={(e) => set('icon', e.target.value.trim())} />
            </div>
          </div>,
        ] : null}
        <div className="CHS-Menu-Field" style={{ gridColumn: '1 / -1' }}>
          <label>Menüde gösterilecek kategoriler</label>
          <div className="CHS-Menu-TagTree">
            {tops.length ? tops.map((t) => [tagRow(t, false), tags.filter((c) => parentOf(c) === t).sort(byPos).map((c) => tagRow(c, true))]) : <small>Kategori bulunamadı.</small>}
          </div>
          <small>İşareti kaldırılan kategori menüde gösterilmez (üst kategori gizlenirse alt kategorileri de gizlenir). Kategori sırası Etiketler sayfasından değiştirilir.</small>
        </div>
      </div>
    );
  }

  viewPreview() {
    const visible = this.items.filter((it) => !it.hidden);
    const pill = (it) => {
      const def = this.defaults(it.key);
      if (it.key === CATEGORY_KEY) {
        return (
          <span className="CHS-Menu-PreviewItem is-group">
            <i className={it.mode === 'dropdown' ? it.icon || 'fas fa-tags' : 'fas fa-tags'}></i> {it.mode === 'dropdown' ? (it.label || 'Kategoriler') + ' ▾' : 'Kategoriler'}
          </span>
        );
      }
      return (
        <span className="CHS-Menu-PreviewItem">
          <i className={it.icon || def.icon || 'fas fa-link'}></i> {it.label || def.label || it.url || it.key}
        </span>
      );
    };
    const nd = this.nd;
    const ndPill = (where) =>
      !nd.hidden && nd[where] !== false ? (
        <span className="CHS-Menu-PreviewItem is-primary">
          <i className={nd.icon || 'fas fa-edit'}></i> {nd.label || 'Bir Tartışma Başlat'}
        </span>
      ) : null;
    return (
      <div className="CHS-Menu-Preview">
        <div>
          <h5>Yatay (ana sayfa)</h5>
          <div className="CHS-Menu-PreviewRow">{ndPill('top')}{visible.filter((it) => it.top !== false).map(pill)}</div>
        </div>
        <div>
          <h5>Dikey (sol menü)</h5>
          <div className="CHS-Menu-PreviewCol">{ndPill('side')}{visible.filter((it) => it.side !== false).map(pill)}</div>
        </div>
      </div>
    );
  }
}
