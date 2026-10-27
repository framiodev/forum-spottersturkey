import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';

/**
 * Akışın üstündeki kategori halkaları (hikâye satırı düzeni). Kapak: Ana Sayfa ayarlarındaki
 * kategori kapağı, yoksa kategorinin arka plan görseli, o da yoksa kategori rengi + simgesi.
 * Son 24 saatte yeni mesaj alan kategorinin halkası renkli.
 */
export default class MobileRings extends Component {
  view() {
    const covers = (() => { try { return JSON.parse(app.forum.attribute('framioTagCovers') || '{}'); } catch (e) { return {}; } })();
    const names = {};
    String(app.forum.attribute('framioChipNames') || '').split('\n').forEach((line) => {
      const i = line.indexOf('=');
      if (i > 0) names[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    const dayAgo = Date.now() - 864e5;

    const tags = app.store.all('tags')
      .filter((t) => t.position && t.position() !== null && !(t.parent && t.parent()))
      .sort((a, b) => a.position() - b.position());
    if (!tags.length) return <div className="MobileRings-empty" />;

    return (
      <nav className="MobileRings" aria-label="Kategoriler">
        {tags.map((t) => {
          const cover = covers[t.id()] || (t.backgroundUrl && t.backgroundUrl());
          const fresh = t.lastPostedAt && t.lastPostedAt() && t.lastPostedAt().getTime() > dayAgo;
          const name = names[t.slug()] || (t.name().includes(' - ') ? t.name().split(' - ').pop().trim() : t.name());
          const href = app.route('tag', { tags: t.slug() });
          return (
            <a href={href} className="MobileRings-item" onclick={(e) => { e.preventDefault(); m.route.set(href); }}>
              <span className={'MobileRings-ring' + (fresh ? ' fresh' : '')}>
                <span className="MobileRings-img" style={cover ? { backgroundImage: 'url(' + cover + ')' } : { background: t.color() || 'var(--control-bg)' }}>
                  {!cover && t.icon() ? <i className={'icon ' + t.icon()} /> : null}
                </span>
              </span>
              <span className="MobileRings-name">{name}</span>
            </a>
          );
        })}
      </nav>
    );
  }
}
