import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';
import type Mithril from 'mithril';

/** Grup duyurusuyla aynı anda gelen site bildirimi: "N yeni paylaşım — ilki: …" */
export default class HighlightNotification extends Notification {
  icon(): string {
    return 'fas fa-bullhorn';
  }

  href(): string {
    const post: any = this.attrs.notification.subject();

    return post && post.discussion ? app.route.post(post) : app.route('index');
  }

  content(): Mithril.Children {
    const data = (this.attrs.notification.content() || {}) as Record<string, any>;
    const label = data.label || '';
    const count = Number(data.count || 1);

    return count > 1
      ? app.translator.trans('framio-notifications.forum.highlight_many', { count, label })
      : app.translator.trans('framio-notifications.forum.highlight_one', { label });
  }

  excerpt(): Mithril.Children {
    return null;
  }
}
