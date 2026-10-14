import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';

/** Ortak: bildirim bağlantısı yorum panelini ilgili yorumla açar */
class CommentNotification extends Notification {
  href() {
    const n = this.attrs.notification;
    const c = n.content() || {};
    const post = n.subject();
    const near = c.postNumber || (post && post.number && post.number());
    const base = c.discussionId
      ? app.route(near && near !== 1 ? 'discussion.near' : 'discussion', { id: c.discussionId, near: near && near !== 1 ? near : undefined })
      : app.route.post(post);
    const postId = post && post.id ? post.id() : '';
    return `${base}${base.includes('?') ? '&' : '?'}pp=${postId}&pc=${c.commentId || ''}`;
  }

  who() {
    const n = this.attrs.notification;
    const user = n.fromUser();
    const c = n.content() || {};
    return user ? user.displayName() : c.guestName || 'Bir ziyaretçi';
  }

  excerpt() {
    const c = this.attrs.notification.content() || {};
    return c.excerpt || '';
  }
}

export class PostCommentedNotification extends CommentNotification {
  icon() {
    return 'fas fa-comments';
  }

  content() {
    return `${this.who()} mesajınıza yorum yaptı`;
  }
}

export class CommentRepliedNotification extends CommentNotification {
  icon() {
    return 'fas fa-reply';
  }

  content() {
    return `${this.who()} yorumunuza yanıt verdi`;
  }
}
