import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Button from 'flarum/common/components/Button';
import HubLightbox from './HubLightbox';

/**
 * /arac/:type/:slug — marka / model / firma / plaka / şehir / yıl derleme sayfası.
 * İlk açılışta veriyi sunucunun gömdüğü app.data.framioHub'dan alır
 * (ek istek yok); SPA içinde gezinince API'den çeker.
 */
export default class HubPage extends Page {
  oninit(vnode) {
    super.oninit(vnode);

    this.items = [];
    this.data = null;
    this.loading = true;

    const type = m.route.param('type');
    const slug = m.route.param('slug');
    const preloaded = app.data.framioHub;

    if (preloaded && preloaded.slug === slug && preloaded.url.endsWith('/' + type + '/' + slug)) {
      delete app.data.framioHub;
      this.apply(preloaded);
    } else {
      this.load(type, slug, 1);
    }
  }

  load(type, slug, page) {
    this.loading = true;
    app
      .request({
        method: 'GET',
        url: app.forum.attribute('apiUrl') + '/seo/hubs',
        params: { type, slug, page },
      })
      .then((res) => this.apply(res.data))
      .catch(() => {
        this.loading = false;
        this.notFound = true;
        m.redraw();
      });
  }

  apply(data) {
    this.data = data;
    this.items = data.page > 1 && this.items.length ? this.items.concat(data.items) : data.items;
    this.loading = false;
    app.setTitle(data.title);
    app.setTitleCount(0);
    m.redraw();
  }

  path(url) {
    const base = app.forum.attribute('baseUrl');
    return url.indexOf(base) === 0 ? url.substr(base.length) || '/' : url;
  }

  view() {
    const d = this.data;

    if (this.notFound) {
      return <div className="FramioHubPage container"><h2>Sayfa bulunamadı</h2></div>;
    }

    return (
      <div className="FramioHubPage container">
        {!d ? (
          <LoadingIndicator />
        ) : (
          <div>
            <nav className="FramioHubPage-crumbs">
              <Link href={app.route('framio-seo.hubs')}>Araçlar</Link> › {d.typeLabel}
            </nav>
            <h1 className="FramioHubPage-title">{d.title}</h1>
            <p className="FramioHubPage-meta">{d.photos || d.total} fotoğraf</p>

            <div className="FramioHubPage-grid">
              {this.items.map((it, i) => (
                <a
                  className="FramioHubPage-card"
                  href={it.url}
                  target="_blank"
                  rel="noopener"
                  onclick={(e) => {
                    // Normal tıklama: lightbox; Ctrl/orta tık: yeni sekmede mesaj
                    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
                    e.preventDefault();
                    this.lightbox = i;
                  }}
                >
                  {it.image ? <img src={it.image} alt={it.alt || it.title} loading="lazy" /> : null}
                  <span className="FramioHubPage-cardTitle">{it.title}{it.count > 1 ? <span className="FramioHubPage-count"> · {it.count} fotoğraf</span> : null}</span>
                  <span className="FramioHubPage-cardMeta">
                    {it.discussion}
                    {it.author ? ' · ' + it.author : ''}
                  </span>
                </a>
              ))}
            </div>

            {d.page < d.pages ? (
              <div className="FramioHubPage-more">
                <Button className="Button" loading={this.loading} onclick={() => this.load(d.path || ({ brand: 'marka', company: 'firma', plate: 'plaka', city: 'sehir', year: 'yil', place: 'yer', route: 'hat' }[d.type] || 'model'), d.slug, d.page + 1)}>
                  Daha fazla göster
                </Button>
              </div>
            ) : null}

            {d.related && d.related.length ? (
              <div className="FramioHubPage-related">
                <h3>İlgili</h3>
                <ul>
                  {d.related.map((r) => (
                    <li>
                      <Link href={this.path(r.url)}>{r.name}</Link> <span>({r.posts})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
        {this.lightbox !== undefined && this.lightbox !== null ? (
          <HubLightbox items={this.items} index={this.lightbox} onclose={() => { this.lightbox = null; }} />
        ) : null}
      </div>
    );
  }
}
