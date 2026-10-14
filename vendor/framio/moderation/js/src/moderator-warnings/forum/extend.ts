import Extend from 'flarum/common/extenders';
import Warning from './model/Warning';
import User from 'flarum/common/models/User';
import WarningNotification from './components/WarningNotification';
import Post from 'flarum/common/models/Post';

export default [
  new Extend.Store() //
    .add('warnings', Warning),

  new Extend.Model(User) //
    .attribute('canViewWarnings')
    .attribute('canManageWarnings')
    .attribute('canDeleteWarnings')
    .attribute('visibleWarningCount'),

  new Extend.Notification() //
    .add('warning', WarningNotification),

  new Extend.Routes() //
    .add('user.warnings', '/u/:username/warnings', () => import('./components/WarningPage')),

  new Extend.Model(Post) //
    .hasMany<Warning>('warnings'),
];
