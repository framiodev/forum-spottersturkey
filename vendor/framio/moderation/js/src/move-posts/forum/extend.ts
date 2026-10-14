import Extend from 'flarum/common/extenders';
import Discussion from 'flarum/common/models/Discussion';
import PostMovedPost from './components/PostMovedPost';
import PostMovedNotification from './components/PostMovedNotification';

export default [
  new Extend.Model(Discussion).attribute<boolean>('isFirstMoved'),
  new Extend.PostTypes().add('postMoved', PostMovedPost),
  new Extend.Notification().add('postMoved', PostMovedNotification),
];
