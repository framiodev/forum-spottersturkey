import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';

/**
 * /kategoriler — telefon için kategori listesi: ana kategoriler ve altındaki kategoriler,
 * dokununca o kategorinin tartışmalarına gider.
 */
export default class MobileCategoriesPage extends Page {
  oninit(vnode) {
    super.oninit(vnode);
    app.setTitle('Kategoriler');
    this.loading = !app.store.all('tags').some((t) => t.discussionCount && t.discussionCount() !== undefined);
    if (this.loading) {
      app.store.find('tags', { include: 'parent' }).then(() => { this.loading = false; m.redraw(); });
    }
  }

  view() {
    if (this.loading) return <div className="MobileCategories"><LoadingIndicator /></div>;

    const all = app.store.all('tags');
    const byPos = (a, b) => (a.position() ?? 999) - (b.position() ?? 999);
    const primaries = all.filter((t) => t.position && t.position() !== null && !(t.parent && t.parent())).sort(byPos);
    const children = (p) => all.filter((t) => t.parent && t.parent() === p).sort(byPos);

    const row = (t, child) => (
      <a href={app.route('tag', { tags: t.slug() })} className={'MobileCategories-row' + (child ? ' is-child' : '')}
        onclick={(e) => { e.preventDefault(); m.route.set(app.route('tag', { tags: t.slug() })); }}>
        <span className="MobileCategories-dot" style={{ background: t.color() || 'var(--control-bg)' }}>
          {t.icon() ? <i className={'icon ' + t.icon()} /> : null}
        </span>
        <span className="MobileCategories-text">
          <b>{t.name()}</b>
          {!child && t.description() ? <small>{t.description()}</small> : null}
        </span>
        <span className="MobileCategories-count">{t.discussionCount() || 0}</span>
      </a>
    );

    return (
      <div className="MobileCategories">
        <div className="MobileTagHeader-seg MobileCategories-seg" role="tablist">
          <button type="button" role="tab" className="on"><i className="icon fas fa-layer-group" /> Kategoriler</button>
          <button type="button" role="tab" onclick={() => m.route.set('/all?topluluk=1')}><i className="icon fas fa-users" /> Topluluk</button>
        </div>
        {primaries.map((p) => (
          <section className="MobileCategories-group">
            {row(p, false)}
            {children(p).map((c) => row(c, true))}
          </section>
        ))}
      </div>
    );
  }
}
