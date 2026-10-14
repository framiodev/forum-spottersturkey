import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import addFriendsTab from './addFriendsTab';
import addFriendBadgeToUserCard from './addFriendBadgeToUserCard';
import addFriendBadgeToPost from './addFriendBadgeToPost';
import addFriendControlToDropdown from './addFriendControlToDropdown';
import addFriendUserSettings from './addFriendUserSettings';
import FriendshipRequestedNotification from './components/FriendshipRequestedNotification';
import FriendshipRemovedNotification from './components/FriendshipRemovedNotification';
import FriendshipDeclinedNotification from './components/FriendshipDeclinedNotification';

export { default as extend } from './extend';

app.initializers.add('forumaker-friendship', () => {
  app.notificationComponents.friendshipRequested = FriendshipRequestedNotification;
  app.notificationComponents.friendshipRemoved = FriendshipRemovedNotification;
  app.notificationComponents.friendshipDeclined = FriendshipDeclinedNotification;

  extend('flarum/forum/components/NotificationGrid' as any, 'notificationTypes', function (items: any) {
    items.add('friendshipRequested', {
      name: 'friendshipRequested',
      icon: 'fas fa-user-plus',
      label: app.translator.trans('forumaker-friendship.forum.settings.notify_requested_label'),
    });
    items.add('friendshipRemoved', {
      name: 'friendshipRemoved',
      icon: 'fas fa-user-minus',
      label: app.translator.trans('forumaker-friendship.forum.settings.notify_removed_label'),
    });
    items.add('friendshipDeclined', {
      name: 'friendshipDeclined',
      icon: 'fas fa-user-times',
      label: app.translator.trans('forumaker-friendship.forum.settings.notify_declined_label'),
    });
  });

  addFriendsTab();
  addFriendBadgeToUserCard();
  addFriendBadgeToPost();
  addFriendControlToDropdown();
  addFriendUserSettings();
});
