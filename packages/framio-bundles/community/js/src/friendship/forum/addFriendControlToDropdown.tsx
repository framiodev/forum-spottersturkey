import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserControls from 'flarum/forum/utils/UserControls';
import type User from 'flarum/common/models/User';
import Button from 'flarum/common/components/Button';
import showFriendActionModal from './showFriendActionModal';

/** "Add friend" / "Remove friend" item in the profile dropdown. */
export default function addFriendControlToDropdown(): void {
  extend(UserControls, 'userControls', function (items: any, user: User) {
    if (!app.session.user) return;
    if (app.session.user.id() === user.id()) return;

    const isFriend = user.attribute('friendshipIsFriend') === true;
    const hasPendingOutgoing = user.attribute('friendshipHasPendingOutgoing') === true;

    if (isFriend) {
      items.add(
        'removeFriend',
        <Button icon="fas fa-user-minus" onclick={() => showFriendActionModal(user)}>
          {app.translator.trans('forumaker-friendship.forum.dropdown.remove_friend_btn')}
        </Button>,
        45
      );

      return;
    }

    if (!app.forum.attribute('canAddFriends')) return;

    items.add(
      'addFriend',
      <Button icon={hasPendingOutgoing ? 'fas fa-ban' : 'fas fa-user-plus'} onclick={() => showFriendActionModal(user)}>
        {app.translator.trans(
          hasPendingOutgoing ? 'forumaker-friendship.forum.dropdown.cancel_request_btn' : 'forumaker-friendship.forum.dropdown.add_friend_btn'
        )}
      </Button>,
      45
    );
  });
}
