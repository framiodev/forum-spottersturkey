import app from 'flarum/forum/app';
import Modal, { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';
import type User from 'flarum/common/models/User';

interface PendingIncomingConfirmModalAttrs extends IInternalModalAttrs {
  /** The user who already sent the actor a friend request. */
  user: User;
  onChange?: () => void;
}

/**
 * Shown instead of AddFriendConfirmModal when the profile being viewed
 * already sent the actor a friend request — offers accepting or declining
 * that request directly rather than trying (and failing) to send a second,
 * reversed one.
 */
export default class PendingIncomingConfirmModal extends Modal<PendingIncomingConfirmModalAttrs> {
  loading: boolean = false;

  className() {
    return 'FriendshipConfirmModal Modal--small';
  }

  title(): Mithril.Children {
    return app.translator.trans('forumaker-friendship.forum.add_modal.title');
  }

  content(): Mithril.Children {
    return (
      <div className="Modal-body">
        <p className="FriendshipConfirmModal-text">{app.translator.trans('forumaker-friendship.forum.pending_modal.text')}</p>
        <div className="FriendshipConfirmModal-actions">
          <Button className="Button Button--primary Button--block" icon="fas fa-user-plus" loading={this.loading} onclick={() => this.respond('accept')}>
            {app.translator.trans('forumaker-friendship.forum.pending_modal.accept_btn')}
          </Button>
          <Button className="Button Button--block" disabled={this.loading} onclick={() => this.respond('decline')}>
            {app.translator.trans('forumaker-friendship.forum.pending_modal.decline_btn')}
          </Button>
        </div>
      </div>
    );
  }

  async respond(action: 'accept' | 'decline'): Promise<void> {
    const requestId = this.attrs.user.attribute('friendshipPendingIncomingRequestId') as number | null;
    if (!requestId) {
      this.hide();
      return;
    }

    this.loading = true;
    m.redraw();

    try {
      await app.request({ method: 'POST', url: `${app.forum.attribute('apiUrl')}/friendship-requests/${requestId}/${action}` });

      if (action === 'accept') {
        this.attrs.user.pushAttributes({
          friendshipIsFriend: true,
          friendshipHasPendingIncoming: false,
          friendshipPendingIncomingRequestId: null,
          friendCount: ((this.attrs.user.attribute('friendCount') as number) || 0) + 1,
        });
        app.session.user?.pushAttributes({ friendCount: ((app.session.user.attribute('friendCount') as number) || 0) + 1 });
        app.alerts.show({ type: 'success' }, app.translator.trans('forumaker-friendship.forum.requests_modal.accept_success'));
      } else {
        this.attrs.user.pushAttributes({ friendshipHasPendingIncoming: false, friendshipPendingIncomingRequestId: null });
      }

      this.hide();
      this.attrs.onChange?.();
    } catch (error) {
      this.loading = false;
      m.redraw();
      throw error;
    }
  }
}
