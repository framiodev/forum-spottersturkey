import app from 'flarum/forum/app';
// IndexPage Flarum 2'de gecikmeli yüklenir (ondan türeyen sayfa ilk açılışta boş kalır): Page + IndexSidebar
import Page from 'flarum/common/components/Page';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import Link from 'flarum/common/components/Link';
import CustomHomepage from './CustomHomepage';

const icon = (name) => <i className={'icon ' + name} aria-hidden="true"></i>;

/** Galerinin kart ve lightbox altyapısı; kendi veri yüklemesi kapalı (veri Keşfet'ten gelir) */
class ExploreGallery extends CustomHomepage {
  initGalleryLoad() {
    this.loadingGallery = false;
  }
}

const PERIODS = [
  ['week', 'Bu hafta'],
  ['month', 'Bu ay'],
  ['year', 'Bu yıl'],
  ['all', 'Tüm zamanlar'],
];

/**
 * Keşfet (Jetphotos / Buslife tarzı fotoğraf vitrini).
 * Bölümler ve sıraları admin'den: Günün Fotoğrafı, En Popüler, Son Eklenenler,
 * Koleksiyonlar, Fotoğrafçılar, Ekipman.
 */
export default class ExplorePage extends Page {
  oninit(vnode) {
    super.oninit(vnode);
    this.bodyClass = 'App--index App--explore';
    this.setTitle();
    this.gallery = new ExploreGallery();
    this.gallery.oninit(vnode);

    this.loading = true;
    this.meta = {};
    this.byPost = {};
    this.lists = { popular: [], recent: [] };
    this.period = 'week';
    this.filter = {};
    this.recentOffset = 0;
    this.recentDone = false;
    this.busy = null;

    this.load();
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    this.gallery.oncreate(vnode);
    // Sütun sayısı ekran genişliğine bağlı (masaüstü 3, mobil 2)
    this.onResize = () => {
      const wide = window.innerWidth > 600;
      if (wide !== this.wasWide) {
        this.wasWide = wide;
        m.redraw();
      }
    };
    this.wasWide = window.innerWidth > 600;
    window.addEventListener('resize', this.onResize);
  }

  onremove(vnode) {
    super.onremove(vnode);
    this.gallery.onremove(vnode);
    window.removeEventListener('resize', this.onResize);
  }

  setTitle() {
    app.setTitle(app.forum.attribute('framioExploreTitle') || 'Keşfet');
    app.setTitleCount(0);
  }

  request(params = {}) {
    return app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/framio/explore', params });
  }

  /** Belgedeki mesajları gruplara çevir, kimliğe göre sakla */
  absorb(doc) {
    const groups = this.gallery.buildGroups(doc.data || [], (doc.meta && doc.meta.spotterExifMap) || {});
    groups.forEach((g) => {
      if (g.real_post_id) this.byPost[String(g.real_post_id)] = g;
    });
    return (doc.meta && doc.meta.explore) || {};
  }

  pick(ids) {
    return (ids || []).map((id) => this.byPost[String(id)]).filter(Boolean);
  }

  load() {
    this.request()
      .then((doc) => {
        this.meta = this.absorb(doc);
        if (this.meta.popular) {
          this.period = this.meta.popular.period;
          this.lists.popular = this.pick(this.meta.popular.ids);
        }
        if (this.meta.recent) {
          this.lists.recent = this.pick(this.meta.recent.ids);
          this.recentDone = this.meta.recent.ids.length < 24;
        }
      })
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  setPeriod(period) {
    if (period === this.period || this.busy) return;
    this.period = period;
    this.busy = 'popular';
    this.request({ section: 'popular', period })
      .then((doc) => {
        const sec = this.absorb(doc);
        this.lists.popular = this.pick(sec.popular && sec.popular.ids);
      })
      .finally(() => {
        this.busy = null;
        m.redraw();
      });
  }

  loadRecent(reset) {
    if (this.busy) return;
    if (reset) {
      this.recentOffset = 0;
      this.recentDone = false;
    }
    this.busy = 'recent';
    const params = Object.assign({ section: 'recent', offset: this.recentOffset }, this.filter);
    this.request(params)
      .then((doc) => {
        const sec = this.absorb(doc);
        const ids = (sec.recent && sec.recent.ids) || [];
        const items = this.pick(ids);
        if (sec.facets) this.meta.facets = sec.facets;
        this.lists.recent = reset ? items : this.lists.recent.concat(items);
        this.recentDone = ids.length < 24;
      })
      .finally(() => {
        this.busy = null;
        m.redraw();
      });
  }

  /** Karta tıklayınca galerinin lightbox'ı; ileri/geri o bölümün fotoğrafları arasında */
  open(e, list, index) {
    this.gallery.galleryPosts = list;
    this.gallery.handlePostClick(e, index);
  }

  title(group) {
    const img = group.images[0];
    const attr = (img && (img.attributes || img)) || {};
    return this.gallery.getAestheticTitle(group, attr.title || attr.filename || '');
  }

  card(group, list, index, size = 480, extraClass = '') {
    const img = group.images[0];
    const title = this.title(group);
    return (
      <a
        className={'Explore-Card ' + extraClass}
        href={app.route('discussion', { id: group.discussion_id }) + '/' + group.post_number}
        onclick={(e) => this.open(e, list, index)}
        key={group.group_id}
      >
        <img src={this.gallery.getSizedUrl(img, size)} alt={title} loading="lazy" decoding="async" className="framio-lazy-img" onload={(e) => e.target.classList.add('loaded')} />
        {group.images.length > 1 ? <span className="Explore-Card-Multi">{icon('fas fa-clone')}</span> : null}
        <span className="Explore-Card-Title">{title}</span>
      </a>
    );
  }

  // ── Bölümler ─────────────────────────────────────────────────────────────

  sectionPotd() {
    const potd = this.meta.potd;
    const group = potd && this.byPost[String(potd.post_id)];
    if (!group) return null;
    const img = group.images[0];
    const title = this.title(group);
    const date = new Date((potd.date || '') + 'T00:00:00');
    const user = app.store.getById('posts', group.real_post_id);

    return (
      <section className="Explore-Potd" key="potd">
        <a
          className="Explore-Potd-Media"
          href={app.route('discussion', { id: group.discussion_id }) + '/' + group.post_number}
          onclick={(e) => this.open(e, [group], 0)}
        >
          <span className="Explore-Potd-Backdrop" style={{ backgroundImage: 'url("' + this.gallery.getSizedUrl(img, 480) + '")' }} aria-hidden="true"></span>
          <img src={this.gallery.getSizedUrl(img, 1600)} alt={title} decoding="async" fetchpriority="high" />
          <div className="Explore-Potd-Info">
            <span className="Explore-Potd-Badge">{icon('fas fa-crown')} Günün Fotoğrafı</span>
            <h2>{title}</h2>
            <span className="Explore-Potd-Date">{isNaN(date) ? '' : date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </a>
      </section>
    );
  }

  sectionPopular() {
    if (!this.meta.popular) return null;
    const potdId = this.meta.potd && String(this.meta.potd.post_id);
    const list = this.lists.popular.filter((g) => String(g.real_post_id) !== potdId);
    return (
      <section className="Explore-Section" key="popular">
        <header className="Explore-Head">
          <h3>{icon('fas fa-fire')} En Popüler</h3>
          <div className="Explore-Tabs" role="tablist">
            {PERIODS.map(([key, label]) => (
              <button type="button" role="tab" aria-selected={this.period === key ? 'true' : 'false'} className={'Explore-Tab' + (this.period === key ? ' is-active' : '')} onclick={() => this.setPeriod(key)}>
                {label}
              </button>
            ))}
          </div>
        </header>
        <div className={'Explore-Grid' + (this.busy === 'popular' ? ' is-busy' : '')}>
          {list.length ? list.map((g, i) => this.card(g, list, i, 640, i === 0 ? 'is-lead' : '')) : <p className="Explore-Empty">Bu dönemde henüz fotoğraf yok.</p>}
        </div>
      </section>
    );
  }

  filterSelect(key, label, options) {
    return (
      <select
        className="FormControl Explore-Filter"
        aria-label={label}
        value={this.filter[key] || ''}
        onchange={(e) => {
          if (e.target.value) this.filter[key] = e.target.value;
          else delete this.filter[key];
          this.loadRecent(true);
        }}
      >
        <option value="">{label}</option>
        {this.filter[key] && !options.some((o) => o.slug === this.filter[key]) ? <option value={this.filter[key]}>{this.filter[key]}</option> : null}
        {options.map((o) => (
          <option value={o.slug}>{o.name + (o.count ? ' (' + o.count + ')' : '')}</option>
        ))}
      </select>
    );
  }

  /**
   * Satır sıralı taş duvar: kartlar sırayla (en yeni önce) o an en kısa sütuna yerleşir;
   * böylece soldan sağa okunur. CSS sütunları yukarıdan aşağı dizdiği için sıra karışık görünüyordu.
   */
  masonryColumns(list) {
    const count = window.innerWidth <= 600 ? 2 : 3;
    const cols = Array.from({ length: count }, () => []);
    const heights = new Array(count).fill(0);
    list.forEach((g, i) => {
      const a = (g.images[0] && (g.images[0].attributes || g.images[0])) || {};
      const w = Number(a.thumb_width || a.width) || 3;
      const h = Number(a.thumb_height || a.height) || 2;
      // Eşite yakın yükseklikte soldaki sütun tercih edilir (sıra soldan sağa kalsın)
      let c = 0;
      heights.forEach((v, k) => {
        if (v < heights[c] - 0.05) c = k;
      });
      cols[c].push(i);
      heights[c] += h / w;
    });
    return cols;
  }

  sectionRecent() {
    if (!this.meta.recent) return null;
    const facets = this.meta.facets || {};
    const tags = (app.store.all('tags') || []).filter((t) => !t.parent || !t.parent()).map((t) => ({ slug: t.slug(), name: t.name() }));
    const list = this.lists.recent;

    return (
      <section className="Explore-Section" key="recent">
        <header className="Explore-Head">
          <h3>{icon('fas fa-clock')} Son Eklenenler</h3>
          <div className="Explore-Filters">
            {tags.length ? this.filterSelect('tag', 'Tüm bölümler', tags) : null}
            {facets.brand && facets.brand.length ? this.filterSelect('brand', 'Tüm markalar', facets.brand) : null}
            {facets.city && facets.city.length ? this.filterSelect('city', 'Tüm şehirler', facets.city) : null}
            {facets.year && facets.year.length ? this.filterSelect('year', 'Tüm yıllar', facets.year) : null}
          </div>
        </header>
        {list.length ? (
          <div className={'Explore-Masonry' + (this.busy === 'recent' && !this.recentOffset ? ' is-busy' : '')}>
            {this.masonryColumns(list).map((col, c) => (
              <div className="Explore-MasonryCol" key={'col' + c}>
                {col.map((i) => this.card(list[i], list, i, 480))}
              </div>
            ))}
          </div>
        ) : (
          <p className="Explore-Empty">Bu seçimle eşleşen fotoğraf yok.</p>
        )}
        {!this.recentDone && list.length ? (
          <div className="Explore-More">
            <button
              type="button"
              className="Button"
              disabled={!!this.busy}
              onclick={() => {
                this.recentOffset += 24;
                this.loadRecent(false);
              }}
            >
              {this.busy === 'recent' ? 'Yükleniyor…' : 'Daha fazla göster'}
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  sectionCollections() {
    const rows = (this.meta.collections || []).filter((r) => r.items && r.items.length);
    if (!rows.length) return null;
    const base = app.forum.attribute('basePath') || '';

    return (
      <section className="Explore-Section" key="collections">
        <header className="Explore-Head">
          <h3>{icon('fas fa-layer-group')} Koleksiyonlar</h3>
        </header>
        {rows.map((row) => (
          <div className="Explore-Strip" key={row.title}>
            <h4>{row.title}</h4>
            <div className="Explore-Strip-Track">
              {row.items.map((it) => (
                <a className="Explore-Coll" href={base + it.path} key={it.slug}>
                  {it.image ? <img src={it.image} alt={it.name} loading="lazy" decoding="async" /> : <span className="Explore-Coll-Blank">{icon('fas fa-bus')}</span>}
                  <span className="Explore-Coll-Name">{it.name}</span>
                  <span className="Explore-Coll-Count">{it.count} fotoğraf</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </section>
    );
  }

  sectionPhotographers() {
    const list = this.meta.photographers || [];
    if (!list.length) return null;

    return (
      <section className="Explore-Section" key="photographers">
        <header className="Explore-Head">
          <h3>{icon('fas fa-camera')} Fotoğrafçılar</h3>
        </header>
        <div className="Explore-People">
          {list.map((p) => {
            const thumbs = this.pick(p.postIds);
            return (
              <div className="Explore-Person" key={p.id}>
                <Link className="Explore-Person-Head" href={app.route('user', { username: p.username })}>
                  {p.avatarUrl ? <img className="Avatar" src={p.avatarUrl} alt="" loading="lazy" /> : <span className="Avatar">{(p.displayName || '?').charAt(0)}</span>}
                  <span className="Explore-Person-Name">{p.displayName}</span>
                  <span className="Explore-Person-Stats">
                    {p.photos} fotoğraf{p.likes ? ' · ' + p.likes + ' beğeni' : ''}
                  </span>
                </Link>
                <div className="Explore-Person-Thumbs">{thumbs.map((g, i) => this.card(g, thumbs, i, 320))}</div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  sectionEquipment() {
    const eq = this.meta.equipment || {};
    const block = (title, items) => {
      if (!items || !items.length) return null;
      const max = items[0].count || 1;
      return (
        <div className="Explore-Eq">
          <h4>{title}</h4>
          <ol>
            {items.map((it) => (
              <li key={it.name}>
                <span className="Explore-Eq-Name">{it.name}</span>
                <span className="Explore-Eq-Bar" style={{ '--w': Math.max(6, Math.round((it.count / max) * 100)) + '%' }}></span>
                <span className="Explore-Eq-Count">{it.count}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    };
    if (!(eq.cameras && eq.cameras.length) && !(eq.lenses && eq.lenses.length)) return null;

    return (
      <section className="Explore-Section" key="equipment">
        <header className="Explore-Head">
          <h3>{icon('fas fa-sliders-h')} Ekipman</h3>
        </header>
        <div className="Explore-EqGrid">
          {block('En çok kullanılan kameralar', eq.cameras)}
          {block('En çok kullanılan lensler', eq.lenses)}
        </div>
      </section>
    );
  }

  hero() {
    const sub = app.forum.attribute('framioExploreSubtitle');
    return (
      <header className="Hero Explore-Hero">
        <div className="container">
          <h1 className="Hero-title">{icon('fas fa-compass')} {app.forum.attribute('framioExploreTitle') || 'Keşfet'}</h1>
          {sub ? <div className="Hero-subtitle">{sub}</div> : null}
        </div>
      </header>
    );
  }

  view() {
    const order = String(app.forum.attribute('framioExploreOrder') || 'potd,popular,recent,collections,photographers,equipment').split(',');
    const render = {
      potd: () => this.sectionPotd(),
      popular: () => this.sectionPopular(),
      recent: () => this.sectionRecent(),
      collections: () => this.sectionCollections(),
      photographers: () => this.sectionPhotographers(),
      equipment: () => this.sectionEquipment(),
    };

    return (
      <div className="IndexPage ExplorePage">
        {this.hero()}
        <div className="container">
          <div className="sideNavContainer">
            <IndexSidebar />
            <div className="IndexPage-results sideNavOffset">
              {this.loading ? (
                <div className="Explore-Loading">
                  <div className="Explore-Skel is-hero"></div>
                  <div className="Explore-Grid">{[0, 1, 2, 3, 4, 5].map((i) => <div className="Explore-Skel" key={i}></div>)}</div>
                </div>
              ) : (
                order.map((k) => (render[k.trim()] ? render[k.trim()]() : null))
              )}
            </div>
          </div>
        </div>
        {this.gallery.lightboxOpen ? this.gallery.renderLightbox() : null}
      </div>
    );
  }
}
