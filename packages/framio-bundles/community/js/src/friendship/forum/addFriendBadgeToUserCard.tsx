import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserCard from 'flarum/forum/components/UserCard';
import Link from 'flarum/common/components/Link';

export default function addFriendBadgeToUserCard(): void {
  extend(UserCard.prototype, 'infoItems', function (items) {
    const user = (this as any).attrs.user;
    if (!user) return;

    if (app.forum.attribute('friendshipShowBadgeOnUserCard') === false) return;
    if (user.attribute('friendshipShowOnUserCard') === false) return;

    const count = (user.attribute('friendCount') as number) || 0;
    if (count === 0) return;

    const color = (app.forum.attribute('friendshipBadgeColor') as string) || '#45698D';
    const icon = (app.forum.attribute('friendshipBadgeIcon') as string) || 'fas fa-hand-peace';

    items.add(
      'friendCount',
      <Link href={app.route('user.friendship', { username: user.username() })} className="FriendshipBadge">
        <i className={icon} style={{ color }} />
        <span className="FriendshipBadge-count">{count}</span>
      </Link>,
      12
    );
  });
}
