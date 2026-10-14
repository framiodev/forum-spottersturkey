import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserCard from 'flarum/forum/components/UserCard';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';
import type User from 'flarum/common/models/User';
import UsercardStat from '../components/UsercardStat';

export default function extendUserCard() {
  extend(UserCard.prototype, 'infoItems', function (items: ItemList<Mithril.Children>) {
    const user = (this.attrs as { user: User }).user;

    items.add(
      'discussion-count',
      <UsercardStat
        icon="fa-solid fa-comment"
        displayText={app.translator.trans('fof-usercard-stats.forum.user.discussion-count', { count: user.discussionCount() })}
      />,
      70
    );

    items.add(
      'comment-count',
      <UsercardStat
        icon="fa-solid fa-comments"
        displayText={app.translator.trans('fof-usercard-stats.forum.user.post-count', { count: user.commentCount() })}
      />,
      65
    );
  });
}
