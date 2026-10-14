import { extend } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import Badge from 'flarum/common/components/Badge';
import Discussion from 'flarum/common/models/Discussion';
import extendModeratorFeatures from './moderatorFeatures';

export { default as extend } from './extend';

app.initializers.add('fof/move-posts', () => {
  app.beforeMount(() => {
    // Only load moderator features for users who can move posts
    if (app.forum.attribute('canMovePosts')) {
      extendModeratorFeatures();
    }
  });

  extend(Discussion.prototype, 'badges', function (badges) {
    if (this.isFirstMoved()) {
      badges.add(
        'firstMoved',
        <Badge type="firstPostMoved" label={app.translator.trans('fof-move-posts.forum.badge.first_moved_tooltip')} icon="fas fa-exchange-alt" />,
        -20
      );
    }
  });
});
