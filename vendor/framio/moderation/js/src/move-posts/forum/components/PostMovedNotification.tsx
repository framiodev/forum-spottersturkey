import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';

export interface PostMovedNotificationContent {
  targetDiscussionId: number | string;
  targetDiscussionTitle: string;
}

export default class PostMovedNotification extends Notification {
  icon() {
    return 'fas fa-exchange-alt';
  }

  href() {
    return app.route('discussion', { id: this.attrs.notification.content<PostMovedNotificationContent>().targetDiscussionId });
  }

  content() {
    return app.translator.trans('fof-move-posts.forum.notifications.post_moved_text', {
      targetDiscussionTitle: (
        <span className="MovePosts-Notification-targetDiscussion">
          {this.attrs.notification.content<PostMovedNotificationContent>().targetDiscussionTitle}
        </span>
      ),
    });
  }

  excerpt() {
    return null;
  }
}
