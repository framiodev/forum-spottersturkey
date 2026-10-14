// @ts-nocheck
import Notification from 'flarum/forum/components/Notification';
import Mithril from 'mithril';
import app from 'flarum/forum/app';

export default class NewStoryNotification extends Notification {
  content(): Mithril.Children {
    return undefined;
  }

  excerpt(): Mithril.Children {
    return app.translator.trans('justoverclock-profile-stories.forum.notifications.newStory');
  }

  href(): string {
    const username = this.attrs.notification?.data?.attributes?.content?.user?.username;
    return `${app.forum.attribute('baseUrl')}/u/${username}/stories`;
  }

  icon(): string {
    return 'fas fa-book-open';
  }
}
