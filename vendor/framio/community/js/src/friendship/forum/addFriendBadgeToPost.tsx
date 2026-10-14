import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Link from 'flarum/common/components/Link';
import type User from 'flarum/common/models/User';
import { getContrastColor } from '../common';

/**
 * Friend-count badge next to the author's name in a post's header — same
 * `userViewItems` extension point PostUser exposes for Arena's stats
 * badge, so both extensions' badges sit in the same row.
 *
 * String-based extend() is required here, not a direct import — see
 * addFriendUserSettings.tsx's docblock for why (confirmed live crash on
 * 2026-08-31 when this used a direct PostUser import).
 */
export default function addFriendBadgeToPost(): void {
  extend('flarum/forum/components/PostUser' as any, 'userViewItems', function (items: any, user: User) {
    if (!user) return;

    if (app.forum.attribute('friendshipShowBadgeOnPost') === false) return;
    if (user.attribute('friendshipShowInPosts') === false) return;

    const count = (user.attribute('friendCount') as number) || 0;
    if (count === 0) return;

    const bgColor = (app.forum.attribute('friendshipBadgeBgColor') as string) || '#45698D';
    const icon = (app.forum.attribute('friendshipBadgeIcon') as string) || 'fas fa-hand-peace';

    items.add(
      'friendCount',
      <Link
        href={app.route('user.friendship', { username: user.username() })}
        className="Badge FriendshipPostBadge"
        style={{ background: bgColor, color: getContrastColor(bgColor) }}
      >
        <i className={icon} />
        <span className="FriendshipPostBadge-count">{count}</span>
      </Link>,
      80
    );
  });
}
