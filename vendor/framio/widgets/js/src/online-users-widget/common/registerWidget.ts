import Widgets from '../../forum-widgets-core/common/extend/Widgets';
import OnlineUsersWidget from './components/OnlineUsersWidget';
import type AdminApplication from 'flarum/admin/AdminApplication';
import type ForumApplication from 'flarum/forum/ForumApplication';

export default function (app: ForumApplication | AdminApplication) {
  new Widgets()
    .add({
      key: 'onlineUsers',
      component: OnlineUsersWidget,
      // Gated on permission alone. Keying this on the list being non-empty
      // would unmount the widget whenever nobody was visible, taking the
      // "no users online" message down with it — the widget renders that
      // message itself.
      isDisabled: (): boolean => !app.forum.attribute<boolean>('canViewOnlineUsersWidget'),
      isUnique: true,
      placement: 'end',
      position: 1,
    })
    .extend(app, 'fof-online-users-widget');
}
