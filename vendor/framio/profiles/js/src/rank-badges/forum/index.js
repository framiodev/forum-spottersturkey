import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import User from 'flarum/common/models/User';
import ItemList from 'flarum/common/utils/ItemList';
import RankBadge from './components/RankBadge';
import Badge from 'flarum/common/components/Badge';

app.initializers.add('framio/rank-badges', () => {
  override(User.prototype, 'badges', function () {
    const items = new ItemList();
    // Model.hasMany() returns `false` (not []) when the `groups` relationship
    // wasn't included in this particular API response (e.g. on the feed page,
    // as opposed to a discussion page where it's eager-loaded) -- fall back to
    // an empty array so we don't crash on `.forEach`.
    const groups = this.groups() || [];

    groups.forEach((group) => {
      items.add(`group${group?.id()}`, <RankBadge group={group} />);
    });

    // For flarum/suspend
    if (app.initializers.has('flarum-suspend')) {
      const until = this.suspendedUntil();

      if (new Date() < until) {
        items.add(
          'suspended',
          <Badge icon="fas fa-ban" type="suspended" label={app.translator.trans('flarum-suspend.forum.user_badge.suspended_tooltip')} />
        );
      }
    }

    return items;
  });
});
