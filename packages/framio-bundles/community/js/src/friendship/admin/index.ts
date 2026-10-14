import app from 'flarum/admin/app';
import FriendshipAdminPage from './components/FriendshipAdminPage';

export { default as extend } from './extend';

app.initializers.add('forumaker-friendship', () => {
  const registry = app.registry.for('forumaker-friendship').registerPage(FriendshipAdminPage);

  registry.registerPermission(
    { permission: 'friendship.addFriends', icon: 'fas fa-user-plus', label: app.translator.trans('forumaker-friendship.admin.permissions.add_friends') },
    'start',
    95
  );
  registry.registerPermission(
    {
      permission: 'friendship.viewOthers',
      icon: 'fas fa-eye',
      label: app.translator.trans('forumaker-friendship.admin.permissions.view_others'),
      allowGuest: true,
    },
    'view',
    95
  );
  registry.registerPermission(
    { permission: 'friendship.moderate', icon: 'fas fa-user-shield', label: app.translator.trans('forumaker-friendship.admin.permissions.moderate') },
    'moderate',
    95
  );
  registry.registerPermission(
    { permission: 'friendship.manage', icon: 'fas fa-cogs', label: app.translator.trans('forumaker-friendship.admin.permissions.manage') },
    'moderate',
    94
  );
});
