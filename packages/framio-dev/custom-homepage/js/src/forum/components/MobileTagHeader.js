import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';

/**
 * Telefon kategori başlığı (onaylı maket 2b): kapak + ad + kısa açıklama + sayılar,
 * alt kategori (marka) halkaları ve Fotoğraflar / Tartışmalar sekmesi.
 */
export default class MobileTagHeader extends Component {
  view() {
    // "tag" adı Mithril vnode alanıyla çakıştığı için özellik adı "category"
    const tag = this.attrs.category;
    if (!tag) return <header className="MobileTagHeader-empty" />;
    const covers = (() => { try { return JSON.parse(app.forum.attribute('framioTagCovers') || '{}'); } catch (e) { return {}; } })();
    const coverOf = (t) => covers[t.id()] || (t.backgroundUrl && t.backgroundUrl()) || null;
    const children = app.store.all('tags')
      .filter((t) => t.parent && t.parent() === tag)
      .sort((a, b) => (a.position() ?? 999) - (b.position() ?? 999));
    const parent = tag.parent && tag.parent();
    const dayAgo = Date.now() - 864e5;

    const sort = m.route.param('sort') || tag.defaultSort() || 'gallery';
    const isPhotos = sort === 'gallery';
    const go = (s) => {
      const params = { tags: tag.slug() };
      if (s) params.sort = s;
      m.route.set(app.route('tag', params), null, { replace: true });
    };

    const cover = coverOf(tag);
    const short = (t) => (t.name().includes(' - ') ? t.name().split(' - ').pop().trim() : t.name());

    return (
      <header className="MobileTagHeader">
        {parent ? (
          <a className="MobileTagHeader-parent" href={app.route('tag', { tags: parent.slug() })}
            onclick={(e) => { e.preventDefault(); m.route.set(app.route('tag', { tags: parent.slug() })); }}>
            <i className="icon fas fa-chevron-left" /> {short(parent)}
          </a>
        ) : null}

        <div className="MobileTagHeader-top">
          <span className="MobileTagHeader-cover" style={cover ? { backgroundImage: 'url(' + cover + ')' } : { background: tag.color() || 'var(--control-bg)' }}>
            {!cover && tag.icon() ? <i className={'icon ' + tag.icon()} /> : null}
          </span>
          <div className="MobileTagHeader-text">
            <h1>{tag.name()}</h1>
            {tag.description() ? <p>{tag.description()}</p> : null}
            <div className="MobileTagHeader-nums">
              <b>{tag.discussionCount() || 0}</b> tartışma
              {children.length ? [' · ', <b>{children.length}</b>, ' alt kategori'] : null}
            </div>
          </div>
        </div>

        {children.length ? (
          <nav className="MobileRings MobileTagHeader-rings" aria-label="Alt kategoriler">
            {children.map((t) => {
              const c = coverOf(t);
              const fresh = t.lastPostedAt && t.lastPostedAt() && t.lastPostedAt().getTime() > dayAgo;
              const href = app.route('tag', { tags: t.slug() });
              return (
                <a href={href} className="MobileRings-item" onclick={(e) => { e.preventDefault(); m.route.set(href); }}>
                  <span className={'MobileRings-ring' + (fresh ? ' fresh' : '')}>
                    <span className="MobileRings-img" style={c ? { backgroundImage: 'url(' + c + ')' } : { background: t.color() || tag.color() || 'var(--control-bg)' }}>
                      {!c && t.icon() ? <i className={'icon ' + t.icon()} /> : null}
                    </span>
                  </span>
                  <span className="MobileRings-name">{short(t)}</span>
                </a>
              );
            })}
          </nav>
        ) : null}

        <div className="MobileTagHeader-seg" role="tablist">
          <button type="button" role="tab" className={isPhotos ? 'on' : ''} onclick={() => go('gallery')}>
            <i className="icon fas fa-th" /> Fotoğraflar
          </button>
          <button type="button" role="tab" className={!isPhotos ? 'on' : ''} onclick={() => go('latest')}>
            <i className="icon fas fa-bars" /> Tartışmalar
          </button>
        </div>
      </header>
    );
  }
}
