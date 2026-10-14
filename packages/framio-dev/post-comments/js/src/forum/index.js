import app from 'flarum/forum/app';
import Extend from 'flarum/common/extenders';
import Post from 'flarum/common/models/Post';
import { extend as extendMethod } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import openComments from './components/CommentsPanel';
import { PostCommentedNotification, CommentRepliedNotification } from './components/CommentNotifications';

export const extend = [
  new Extend.Model(Post).attribute('postCommentCount').attribute('postCommentPreview'),
  new Extend.Notification().add('postCommented', PostCommentedNotification).add('postCommentReplied', CommentRepliedNotification),
];

/** Bildirimden gelinen bağlantı: ?pc=<yorum>&pp=<mesaj> → paneli o yorumla aç */
function linkedComment() {
  try {
    const q = new URLSearchParams(window.location.search);
    return { post: q.get('pp'), comment: q.get('pc') };
  } catch (e) {
    return {};
  }
}

function clearLink() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('pp');
    url.searchParams.delete('pc');
    window.history.replaceState(window.history.state, '', url.toString());
  } catch (e) {}
}

app.initializers.add('framio-post-comments', () => {
  extendMethod(CommentPost.prototype, 'actionItems', function (items) {
    const post = this.attrs.post;
    if (post.isHidden() || post.contentType() !== 'comment') return;

    const count = post.attribute('postCommentCount') || 0;

    items.add(
      'post-comments',
      <button className="Button Button--link PostComments-Button" onclick={() => openComments(post)}>
        <i className="fas fa-comments" aria-hidden="true"></i>
        <span>Yorumlar</span>
        {count ? <span className="PostComments-CountBadge">{count}</span> : null}
      </button>,
      90
    );
  });

  // Mesajın altında son yorum önizlemesi (tıklayınca panel açılır)
  extendMethod(CommentPost.prototype, 'footerItems', function (items) {
    const post = this.attrs.post;
    if (!app.forum.attribute('framioPostCommentsPreview') || post.isHidden() || post.contentType() !== 'comment') return;
    const p = post.attribute('postCommentPreview');
    const count = post.attribute('postCommentCount') || 0;
    if (!p) return;

    items.add(
      'post-comments-preview',
      <div className="PostComments-Preview" onclick={() => openComments(post)}>
        {p.avatarUrl ? (
          <img className="PostComments-Preview-Avatar" src={p.avatarUrl} alt="" />
        ) : (
          <span className="PostComments-Preview-Avatar is-letter">{(p.name || '?').charAt(0).toLocaleUpperCase('tr-TR')}</span>
        )}
        <div className="PostComments-Preview-Bubble">
          <strong>{p.name}</strong> <span>{p.text}</span>
        </div>
        {count > 1 ? <span className="PostComments-Preview-More">{count - 1} yorum daha</span> : null}
      </div>,
      -10
    );
  });

  extendMethod(CommentPost.prototype, 'oncreate', function () {
    const link = linkedComment();
    if (link.post && String(this.attrs.post.id()) === link.post) {
      clearLink();
      setTimeout(() => openComments(this.attrs.post, { focus: link.comment }), 300);
    }
  });

  // NotificationGrid gecikmeli yüklenir; adıyla genişletilir
  extendMethod('flarum/forum/components/NotificationGrid', 'notificationTypes', function (items) {
    items.add('postCommented', { name: 'postCommented', icon: 'fas fa-comments', label: 'Mesajıma yorum yapıldığında' });
    items.add('postCommentReplied', { name: 'postCommentReplied', icon: 'fas fa-reply', label: 'Yorumuma yanıt verildiğinde' });
  });
});
