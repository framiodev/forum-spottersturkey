import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';
import type Mithril from 'mithril';

/** "Someone sent me a friend request" notification. Subject is the sender. */
export default class FriendshipRequestedNotification extends Notification {
  icon(): string {
    return 'fas fa-user-plus';
  }

  href(): string {
    // Not the sender's profile — straight to the recipient's own "Друзья"
    // page, Заявки modal, with the request highlighted (see FriendsPage's
    // requestId query param handling).
    if (!app.session.user) return '#';

    const data = (this.attrs.notification.content() || {}) as Record<string, any>;

    return app.route('user.friendship', { username: app.session.user.username(), requestId: data.requestId });
  }

  content(): Mithril.Children {
    const fromUser = this.attrs.notification.fromUser();
    const data = (this.attrs.notification.content() || {}) as Record<string, any>;
    const name = fromUser?.displayName() ?? data.senderName ?? '?';

    return app.translator.trans('forumaker-friendship.forum.notifications.requested_text', {
      name: <strong>{name}</strong>,
    });
  }

  excerpt(): Mithril.Children {
    return null;
  }
}
