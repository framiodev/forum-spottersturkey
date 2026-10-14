import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserStories from './pages/UserStories';
import UserPage from 'flarum/forum/components/UserPage';
import Mithril from 'mithril';
import ItemList from 'flarum/common/utils/ItemList';
import UserCard from 'flarum/forum/components/UserCard';
// @ts-ignore
import LinkButton from 'flarum/common/components/LinkButton';
const icon = (iconName, attrs = {}) => { attrs.className = (attrs.className || "") + " icon " + iconName; return m("i", attrs); };
import type User from 'flarum/common/models/User';
import GlobalStories from './pages/GlobalStories';
import IndexPage from 'flarum/forum/components/IndexPage';
import NewStoryNotification from './components/notifications/NewStoryNotification';
import Notification from 'flarum/forum/components/Notification';
import { REP_NOTIFICATIONS } from './notifications';

app.initializers.add('justoverclock/profile-stories', () => {
  app.notificationComponents.newStory = NewStoryNotification;

  app.routes['user.stories'] = {
    path: '/u/:username/stories',
    component: UserStories,
  };

  app.routes.globalStories = {
    path: '/all-users-stories',
    component: GlobalStories,
  };

  extend('flarum/forum/components/NotificationGrid', 'notificationTypes', function (items) {
    REP_NOTIFICATIONS.forEach((notification) => {
      items.add(notification.name, {
        name: notification.name,
        icon: notification.icon,
        label: notification.label,
      });
    });
  });

  extend(IndexPage.prototype, 'navItems', function (items) {
    items.add(
      'globalStories',
      <LinkButton href={app.route('globalStories')} icon="fas fa-book-open">
        {app.translator.trans('justoverclock-profile-stories.forum.globalStories')}
      </LinkButton>
    );
  });

  extend(UserCard.prototype, 'infoItems', function (items) {
    // @ts-expect-error
    const user = this.attrs.user as User;
    const storyCount = user.data?.attributes?.storyCount;
    if (user && app.session.user) {
      items.add(
        'storiesCount',
        <span className="UserCard-storiesCount">
          {icon('fas fa-book-open')}
          {app.translator.trans('justoverclock-profile-stories.forum.stories-count', { count: storyCount })}
        </span>
      );
    }
  });

  extend(UserPage.prototype, 'navItems', function (items: ItemList<Mithril.Children>) {
    // @ts-ignore missing type-hint in Flarum
    const user = this.user;

    if (user) {
      items.add(
        'profilestories',
        <LinkButton href={app.route('user.stories', { username: user?.slug() })} name="stories" icon="fas fa-book-open">
          {app.translator.trans('justoverclock-profile-stories.forum.stories')}
        </LinkButton>
      );
    }
  });
});
