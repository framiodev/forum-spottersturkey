import app from 'flarum/forum/app';
import Modal, { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';
import type User from 'flarum/common/models/User';
import type { Friendship } from '../../common';

interface RemoveFriendConfirmModalAttrs extends IInternalModalAttrs {
  /** The friend being removed — used for the confirmation text either way. */
  user: User;
  /**
   * When set (the friends list, which already has the row loaded — see
   * FriendsPage), deletes this specific row via the JSON:API endpoint, so
   * a moderator removing a friendship from someone else's page works too.
   * Otherwise (the profile dropdown, which only knows a target User) falls
   * back to the actor-relative /friendships/remove endpoint.
   */
  friendship?: Friendship;
  onRemoved?: () => void;
}

export default class RemoveFriendConfirmModal extends Modal<RemoveFriendConfirmModalAttrs> {
  loading: boolean = false;

  className() {
    return 'FriendshipConfirmModal Modal--small';
  }

  title(): Mithril.Children {
    return app.translator.trans('forumaker-friendship.forum.remove_modal.title');
  }

  content(): Mithril.Children {
    return (
      <div className="Modal-body">
        <p className="FriendshipConfirmModal-text">
          {/* Raw User model under `user` — see AddFriendConfirmModal's
              identical comment for why (Translator.preprocessParameters()
              special-cases that key). */}
          {app.translator.trans('forumaker-friendship.forum.remove_modal.text', { user: this.attrs.user })}
        </p>
        <div className="FriendshipConfirmModal-actions">
          <Button className="Button Button--danger Button--block" icon="fas fa-user-minus" loading={this.loading} onclick={() => this.remove()}>
            {app.translator.trans('forumaker-friendship.forum.remove_modal.confirm_btn')}
          </Button>
          <Button className="Button Button--block" disabled={this.loading} onclick={() => this.hide()}>
            {app.translator.trans('forumaker-friendship.forum.remove_modal.cancel_btn')}
          </Button>
        </div>
      </div>
    );
  }

  async remove(): Promise<void> {
    this.loading = true;
    m.redraw();

    try {
      if (this.attrs.friendship) {
        await this.attrs.friendship.delete();
      } else {
        await app.request({
          method: 'POST',
          url: `${app.forum.attribute('apiUrl')}/friendships/remove`,
          body: { userId: this.attrs.user.id() },
        });
      }

      this.attrs.user.pushAttributes({
        friendshipIsFriend: false,
        friendCount: Math.max(0, ((this.attrs.user.attribute('friendCount') as number) || 0) - 1),
      });

      // No response body carries updated user resources for either removal
      // path, so the other side of the pair is decremented locally too —
      // friendship.user() when a specific row was loaded (FriendsPage,
      // possibly moderating someone else's list), otherwise the actor
      // (the profile dropdown only ever acts on its own relationship).
      const owner = this.attrs.friendship?.user() ?? app.session.user;
      owner?.pushAttributes({ friendCount: Math.max(0, ((owner.attribute('friendCount') as number) || 0) - 1) });

      this.hide();
      this.attrs.onRemoved?.();
      app.alerts.show({ type: 'success' }, app.translator.trans('forumaker-friendship.forum.remove_modal.success'));
    } catch (error) {
      this.loading = false;
      m.redraw();
      throw error;
    }
  }
}
