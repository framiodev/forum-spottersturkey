import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';

/** /arac — marka, model, firma, plaka, şehir ve yıl derlemelerinin dizini. */
export default class HubIndexPage extends Page {
  oninit(vnode) {
    super.oninit(vnode);

    this.groups = app.data.framioHubIndex || null;
    delete app.data.framioHubIndex;

    app.setTitle('Araçlar');
    app.setTitleCount(0);

    if (!this.groups) {
      app
        .request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/seo/hubs' })
        .then((res) => {
          this.groups = res.data;
          m.redraw();
        })
        .catch(() => {
          this.groups = [];
          m.redraw();
        });
    }
  }

  path(url) {
    const base = app.forum.attribute('baseUrl');
    return url.indexOf(base) === 0 ? url.substr(base.length) || '/' : url;
  }

  view() {
    return (
      <div className="FramioHubPage container">
        <h1 className="FramioHubPage-title">Marka, model, firma, plaka, şehir ve yıla göre araç fotoğrafları</h1>
        {!this.groups ? (
          <LoadingIndicator />
        ) : (
          this.groups
            .filter((g) => g.items && g.items.length)
            .map((g) => (
              <section className="FramioHubPage-group" id={g.path}>
                <h2>{g.label}</h2>
                <ul className="FramioHubPage-tags">
                  {g.items.map((it) => (
                    <li>
                      <Link href={this.path(it.url)}>{it.name}</Link> <span>{it.posts}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
        )}
      </div>
    );
  }
}
