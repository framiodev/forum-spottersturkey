import Badge from 'flarum/common/components/Badge';
import { extend } from 'flarum/common/extend';
import Discussion from 'flarum/common/models/Discussion';
import app from 'flarum/forum/app';

export default function addDiscussionBadge(): void {
  extend(Discussion.prototype, 'badges', function (badges) {
    if (this.bookmarked()) {
      badges.add('bookmarked', <Badge label={app.translator.trans('fof-bookmarks.forum.badge')} icon="fas fa-bookmark" type="bookmarked" />);
    }
  });
}
