import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import Avatar from 'flarum/common/components/Avatar';
import humanTime from 'flarum/common/utils/humanTime';
import CommentPost from 'flarum/forum/components/CommentPost';

/**
 * Telefon mesaj sayfasında fotoğrafsız cevap: Instagram yorumu düzeni
 * (küçük avatar · kalın ad + metin · "zaman · Yanıtla" · sağda küçük kalp).
 */
export default class MobileCommentRow extends Component {
  view() {
    const post = this.attrs.post;
    const user = post.user();
    const likes = (post.likes && post.likes()) || [];
    const me = app.session.user;
    const isLiked = !!(me && likes.some((u) => u === me));
    const count = likes.length;

    return (
      <div className="FeedComment">
        {user ? <Link href={app.route.user(user)} className="FeedComment-av"><Avatar user={user} /></Link> : <span className="FeedComment-av" />}
        <div className="FeedComment-main">
          <div className="FeedComment-body">
            {user ? <Link href={app.route.user(user)} className="FeedComment-name">{user.displayName()}</Link> : null}
            <div className="FeedComment-text">{m.trust(post.contentHtml() || '')}</div>
          </div>
          <div className="FeedComment-meta">
            {humanTime(post.createdAt())}
            {count ? <span> · {count} beğeni</span> : null}
            <button type="button" onclick={() => this.reply()}>Yanıtla</button>
          </div>
        </div>
        <button type="button" className={'FeedComment-like' + (isLiked ? ' liked' : '')} aria-label="Beğen" onclick={() => this.like(isLiked)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8Z" /></svg>
        </button>
      </div>
    );
  }

  // Flarum'un kendi "Yanıtla" işlemi (alıntılı yanıt) kullanılır
  reply() {
    try {
      const cp = new CommentPost();
      cp.attrs = { post: this.attrs.post };
      const item = cp.actionItems().toArray().find((v) => v && v.itemName === 'reply');
      if (item && item.attrs && item.attrs.onclick) item.attrs.onclick();
    } catch (e) {}
  }

  like(isLiked) {
    const post = this.attrs.post;
    if (!app.session.user) {
      import('flarum/forum/components/LogInModal').then((mod) => app.modal.show(mod.default));
      return;
    }
    const me = app.session.user;
    const likes = ((post.likes && post.likes()) || []).filter((u) => u !== me);
    if (!isLiked) likes.unshift(me);
    post.pushData({ relationships: { likes } });
    post.save({ isLiked: !isLiked });
  }
}
