import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';

/**
 * Telefonda ana sayfa ve kategori sayfalarının üstünde yana kaydırılan kategori çipleri.
 * Çekirdeğin "Ana Sayfa ⇕" seçicisinin yerini alır. Masaüstünde CSS ile gizlidir.
 */
export default class MobileChips extends Component {
  view() {
    const route = app.current.get('routeName');
    // Ana sayfa bu sitede "tags" rotasında (özel ana sayfa) çalışır
    if (route !== 'index' && route !== 'tag' && route !== 'tags') return <div className="MobileChips-empty" />;

    const params = m.route.param() || {};
    const path = (m.route.get() || '/').split('?')[0];
    // Topluluk görünümü: çipler yerine Kategoriler / Topluluk sekmesi
    if (params.topluluk) {
      return (
        <div className="MobileTagHeader-seg MobileCategories-seg" role="tablist">
          <button type="button" role="tab" onclick={() => m.route.set('/kategoriler')}><i className="icon fas fa-layer-group" /> Kategoriler</button>
          <button type="button" role="tab" className="on"><i className="icon fas fa-users" /> Topluluk</button>
        </div>
      );
    }
    // Akış'ta kategori halkaları aynı işi görür: çip satırı gizlenir
    if (path === '/all' && params.sort === 'feed') return <div className="MobileChips-empty" />;
    // Kategori sayfasında başlıktaki alt kategori halkaları yeterli
    if (route === 'tag') return <div className="MobileChips-empty" />;
    const activeSlug = route === 'tag' ? params.tags : null;
    const tags = (app.store.all('tags') || [])
      .filter((t) => t.isPrimary && t.isPrimary() && !(t.parent && t.parent()) && t.position && t.position() !== null)
      .sort((a, b) => a.position() - b.position());

    const chip = (label, href, active) => (
      <a href={href} className={'MobileChips-chip' + (active ? ' active' : '')}
        onclick={(e) => { e.preventDefault(); m.route.set(href); }}>{label}</a>
    );

    return (
      <nav className="MobileChips" aria-label="Kategoriler">
        {chip('Ana Sayfa', '/', path === '/' || route === 'tags')}
        {chip('Akış', '/all?sort=feed', path === '/all' && params.sort === 'feed')}
        {chip('Tümü', '/all', path === '/all' && params.sort !== 'feed')}
        {tags.map((t) => chip(this.shortName(t),app.route('tag', { tags: t.slug() }), activeSlug === t.slug()))}
      </nav>
    );
  }

  // Kısa ad: admin'deki "adres = Kısa ad" satırları; yoksa adın " - " sonrası
  shortName(tag) {
    if (!this.names) {
      this.names = {};
      String(app.forum.attribute('framioChipNames') || '').split('\n').forEach((line) => {
        const i = line.indexOf('=');
        if (i > 0) this.names[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      });
    }
    const name = tag.name();
    return this.names[tag.slug()] || (name.includes(' - ') ? name.split(' - ').pop().trim() : name);
  }

  onupdate(vnode) {
    // Etkin çip görünür alanda kalsın
    const active = vnode.dom.querySelector && vnode.dom.querySelector('.active');
    if (active && active !== this.lastActive) {
      this.lastActive = active;
      active.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }
}
