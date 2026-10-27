import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import Avatar from 'flarum/common/components/Avatar';
import humanTime from 'flarum/common/utils/humanTime';
import CommentPost from 'flarum/forum/components/CommentPost';

/**
 * Telefon akış kartı (Instagram düzeni): Flarum mesaj bileşeni yerine kendi kartımız.
 * Üst satır avatar · ad · zaman, kenardan kenara fotoğraflar (birden çoksa yana kaydırma),
 * etkileşim simgeleri, beğeni sayısı, başlık + künye ve yorumlara bağlantı.
 */
// Maketteki çizgi simgeler (24 px, 1.8 kalınlık)
const svg = (d, extra = {}) => m('svg', { className: 'FeedIcon', viewBox: '0 0 24 24', 'aria-hidden': 'true', ...extra }, m('path', { d }));
const ICONS = {
  heart: svg('M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8Z'),
  comment: svg('M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.7A8.4 8.4 0 1 1 21 11.5Z'),
  repost: svg('M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3'),
  send: svg('m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13'),
  more: svg('M5 12h.01M12 12h.01M19 12h.01', { style: 'stroke-width:3' }),
};

export default class MobileFeedCard extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.index = 0;
    this.parse();
  }

  // Mesaj içeriğinden fotoğrafları ve künye satırlarını ayıklar
  parse() {
    const post = this.attrs.post;
    const box = document.createElement('div');
    box.innerHTML = post.contentHtml() || '';
    this.images = [...box.querySelectorAll('img')]
      .filter((i) => !i.classList.contains('emoji') && !/avatar|emoji/i.test(i.className))
      .map((i) => {
        const box2 = i.closest('[data-id]');
        return { src: i.getAttribute('src') || i.getAttribute('data-src'), alt: i.getAttribute('alt') || '', w: i.getAttribute('width'), h: i.getAttribute('height'), id: box2 ? box2.getAttribute('data-id') : null };
      })
      .filter((i) => i.src);
    // Künye: masaüstündeki kartın kendi HTML'i aynen kullanılır (tasarım kimliği korunur)
    const kunye = box.querySelector('.framio-kunye-card') || box.querySelector('ul');
    this.kunyeHtml = kunye ? kunye.outerHTML : '';
    this.facts = [...box.querySelectorAll('ul li')].map((li) => li.textContent.trim()).filter(Boolean).slice(0, 4);
    box.querySelectorAll('ul, img, script, style').forEach((n) => n.remove());
    this.caption = box.textContent.replace(/\s+/g, ' ').trim().slice(0, 160);
  }

  view() {
    const post = this.attrs.post;
    const user = post.user();
    const discussion = post.discussion();
    const url = app.route.post(post);
    const likes = post.likes ? post.likes() || [] : [];
    const likesCount = (post.likesCount && post.likesCount()) || likes.length;
    const me = app.session.user;
    const isLiked = !!(me && likes.some((u) => u === me));
    const replies = discussion ? Math.max(0, (discussion.commentCount() || 1) - 1) : 0;
    const multi = this.images.length > 1;

    // Konum: künyenin son satırı ("Küçükkuyu - Çanakkale / '26" → "Küçükkuyu · Çanakkale")
    const place = this.facts.length > 1 ? this.facts[this.facts.length - 1].split(' / ')[0].replace(/\s+-\s+/g, ' · ') : '';

    return (
      <article className="FeedCard">
        <header className="FeedCard-head">
          {user ? <Link href={app.route.user(user)} className="FeedCard-av"><Avatar user={user} /></Link> : null}
          <div className="FeedCard-who">
            {user ? <Link href={app.route.user(user)}><b>{user.displayName()}</b></Link> : null}
            {place ? <span>{place}</span> : null}
          </div>
          <button type="button" className="FeedCard-menu" aria-label="Seçenekler" onclick={() => this.share(url)}>{ICONS.more}</button>
        </header>

        {this.images.length ? (
          <div className="FeedCard-media">
            <div className="FeedCard-track Post-body" onscroll={(e) => { const n = Math.round(e.target.scrollLeft / e.target.clientWidth); if (n !== this.index) { this.index = n; m.redraw(); } }}>
              {this.images.map((img) => (
                <div className="FeedCard-slide">
                  <img src={img.src} alt={img.alt} loading="lazy" decoding="async" width={img.w} height={img.h} />
                </div>
              ))}
            </div>
            {multi ? <span className="FeedCard-count">{this.index + 1}/{this.images.length}</span> : null}
          </div>
        ) : null}

        {this.exifCard()}

        <div className="FeedCard-actions">
          <button type="button" className={'FeedCard-act' + (isLiked ? ' liked' : '')} aria-label="Beğen"
            onclick={() => this.toggleLike(isLiked)} disabled={post.canLike && post.canLike() === false}>{ICONS.heart}</button>
          <Link className="FeedCard-act" href={url} aria-label="Yorumlar">{ICONS.comment}</Link>
          <button type="button" className="FeedCard-act" aria-label="Ağa aktar" onclick={() => this.runAction('framio-social-hub', url)}>{ICONS.repost}</button>
          <button type="button" className="FeedCard-act" aria-label="Gönder" onclick={() => this.runAction('shareAsMessage', url)}>{ICONS.send}</button>
          {multi ? <span className="FeedCard-dots">{this.images.map((_, k) => <i className={k === this.index ? 'on' : ''} />)}</span> : null}
        </div>

        {likesCount ? <div className="FeedCard-likes"><b>{likesCount}</b> beğeni</div> : null}

        <div className="FeedCard-text">
          {discussion ? <Link href={url} className="FeedCard-title">{discussion.title()}</Link> : null}
          {!this.kunyeHtml && this.caption ? <p>{this.caption}</p> : null}
        </div>
        {this.kunyeHtml ? <div className="FeedCard-kunye Post-body">{m.trust(this.kunyeHtml)}</div> : null}
        <div className="FeedCard-text">
          {replies ? <Link href={url} className="FeedCard-more">{replies} yorumun tümünü gör</Link> : null}
          <span className="FeedCard-when">{humanTime(post.createdAt())}</span>
        </div>
      </article>
    );
  }

  // Eklenti işlemini adıyla çalıştırır (Gönder = shareAsMessage, ağa aktar = framio-social-hub);
  // işlem yoksa (yetki/eklenti kapalı) paylaşım menüsü açılır
  runAction(name, url) {
    try {
      const cp = new CommentPost();
      cp.attrs = { post: this.attrs.post };
      const item = cp.actionItems().toArray().find((v) => v && v.itemName === name);
      const onclick = item && item.attrs && item.attrs.onclick;
      if (onclick) return onclick();
    } catch (e) {}
    this.share(url);
  }

  // Açık fotoğrafın EXIF kartı: Upload & EXIF eklentisinin kendi bileşeni (mesaj sayfasındakiyle aynı)
  exifCard() {
    const img = this.images[this.index];
    const Card = window.FramioImageManager && window.FramioImageManager.SpotterImageCard;
    if (!img || !img.id || !Card) return null;
    // Anahtar yalnızca iç bileşende: kart içindeki diğer elemanlar anahtarsız olduğundan dış kutu anahtarsız kalmalı
    // Masaüstündeki sarmalayıcılarla aynı yapı: kartın kendi stilleri bu sınıflara bağlı
    return (
      <div className="FeedCard-exif Post-body">
        <div className="framio-image-container SpotterCard">
          <div className="spotter-exif-placeholder">{[m(Card, { key: 'exif-' + img.id, photoId: img.id, post: this.attrs.post })]}</div>
        </div>
      </div>
    );
  }

  toggleLike(isLiked) {
    const post = this.attrs.post;
    if (!app.session.user) {
      import('flarum/forum/components/LogInModal').then((mod) => app.modal.show(mod.default));
      return;
    }
    const me = app.session.user;
    const likes = ((post.likes && post.likes()) || []).filter((u) => u !== me);
    if (!isLiked) likes.unshift(me);
    post.pushData({ relationships: { likes } });
    if (post.likesCount) post.pushAttributes({ likesCount: (post.likesCount() || 0) + (isLiked ? -1 : 1) });
    post.save({ isLiked: !isLiked });
  }

  // Paylaşım menüsü (alttan açılan sayfa): bağlantı paylaşımı + eklentilerin mesaja eklediği işlemler
  // (Sosyal Medyada Paylaş, ağa aktar vb.) — Flarum mesaj bileşeninin işlem listesinden alınır.
  share(url) {
    let items = [];
    try {
      const cp = new CommentPost();
      cp.attrs = { post: this.attrs.post };
      items = cp.actionItems().toArray().filter((v) => v && !['like', 'reply', 'react', 'post-comments'].includes(v.itemName));
    } catch (e) {}

    const host = document.createElement('div');
    host.className = 'FeedSheet';
    const close = () => { m.mount(host, null); host.remove(); };
    document.body.appendChild(host);
    m.mount(host, {
      view: () => (
        <div className="FeedSheet-backdrop" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="FeedSheet-panel" onclick={(e) => { if (e.target.closest('button, a') && !e.target.closest('.FeedSheet-link')) setTimeout(close, 0); }}>
            <span className="FeedSheet-grip" />
            <button type="button" className="FeedSheet-link Button" onclick={() => { this.nativeShare(url); close(); }}>
              <i className="icon fas fa-link" /> Bağlantıyı paylaş
            </button>
            {items}
          </div>
        </div>
      ),
    });
  }

  nativeShare(url) {
    const full = app.forum.attribute('baseUrl') + url.replace(app.forum.attribute('basePath') || '', '');
    const title = this.attrs.post.discussion() ? this.attrs.post.discussion().title() : document.title;
    if (navigator.share) navigator.share({ title, url: full }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(full).then(() => app.alerts.show({ type: 'success' }, 'Bağlantı kopyalandı'));
  }
}
