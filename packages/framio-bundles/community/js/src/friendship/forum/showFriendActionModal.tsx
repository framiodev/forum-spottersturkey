import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';
import AddFriendConfirmModal from './components/AddFriendConfirmModal';
import RemoveFriendConfirmModal from './components/RemoveFriendConfirmModal';
import PendingIncomingConfirmModal from './components/PendingIncomingConfirmModal';
import CancelRequestConfirmModal from './components/CancelRequestConfirmModal';
import type { Friendship } from '../common';

/**
 * Opens whichever confirm modal fits the actor's current relationship with
 * `user` — shared between the profile dropdown control and the "Друзья"
 * page's own header button, so both stay in sync as this branching grows.
 */
export default function showFriendActionModal(user: User, opts: { friendship?: Friendship; onChange?: () => void } = {}): void {
  if (user.attribute('friendshipIsFriend') === true) {
    app.modal.show(RemoveFriendConfirmModal, { user, friendship: opts.friendship, onRemoved: opts.onChange });
    return;
  }

  if (user.attribute('friendshipHasPendingIncoming') === true) {
    app.modal.show(PendingIncomingConfirmModal, { user, onChange: opts.onChange });
    return;
  }

  if (user.attribute('friendshipHasPendingOutgoing') === true) {
    app.modal.show(CancelRequestConfirmModal, { user, onChange: opts.onChange });
    return;
  }

  app.modal.show(AddFriendConfirmModal, { user, onSent: opts.onChange });
}
