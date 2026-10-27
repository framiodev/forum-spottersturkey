import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';

/**
 * Telefonda ana sayfa ve kategori sayfalarının üstünde yana kaydırılan kategori çipleri.
 * Çekirdeğin "Ana Sayfa ⇕" seçicisinin yerini alır. Masaüstünde CSS ile gizlidir.
 */
export default class MobileChips extends Component {
  view() {
    const route = app.current.get('routeName');
    if (route !== 'index' && route !== 'tag') return <div className="MobileChips-empty" />;

    const params = m.route.param() || {};
    const path = (m.route.get() || '/').split('?')[0];
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
        {chip('Ana Sayfa', '/', path === '/')}
        {chip('Tümü', '/all', path === '/all')}
        {tags.map((t) => chip(t.name(), app.route('tag', { tags: t.slug() }), activeSlug === t.slug()))}
      </nav>
    );
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
