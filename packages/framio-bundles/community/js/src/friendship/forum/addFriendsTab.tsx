import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserPage from 'flarum/forum/components/UserPage';
import LinkButton from 'flarum/common/components/LinkButton';

export default function addFriendsTab(): void {
  extend(UserPage.prototype, 'navItems', function (items) {
    const user = (this as any).user;
    if (!user) return;

    const isOwnPage = app.session.user?.id() === user.id();

    if (!isOwnPage && !app.forum.attribute('canViewOthersFriends') && !app.forum.attribute('canModerateFriendships')) {
      return;
    }

    items.add(
      'friendship',
      <LinkButton href={app.route('user.friendship', { username: user.username() })} icon="fas fa-user-friends">
        {app.translator.trans('forumaker-friendship.forum.user.friends_tab')}
      </LinkButton>,
      65
    );
  });
}
