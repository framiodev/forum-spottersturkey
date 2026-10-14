import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';
import type Mithril from 'mithril';
import type User from 'flarum/common/models/User';

/** "Someone declined my friend request" notification. Subject is the decliner. */
export default class FriendshipDeclinedNotification extends Notification {
  icon(): string {
    return 'fas fa-user-times';
  }

  href(): string {
    const user = this.attrs.notification.subject() as User | null;
    return user ? app.route.user(user) : '#';
  }

  content(): Mithril.Children {
    const fromUser = this.attrs.notification.fromUser();
    const data = (this.attrs.notification.content() || {}) as Record<string, any>;
    const name = fromUser?.displayName() ?? data.declinerName ?? '?';

    return app.translator.trans('forumaker-friendship.forum.notifications.declined_text', {
      name: <strong>{name}</strong>,
    });
  }

  excerpt(): Mithril.Children {
    return null;
  }
}
