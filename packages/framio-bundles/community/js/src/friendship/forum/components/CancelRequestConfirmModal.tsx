import app from 'flarum/forum/app';
import Modal, { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';
import type User from 'flarum/common/models/User';

interface CancelRequestConfirmModalAttrs extends IInternalModalAttrs {
  /** The recipient of the actor's own pending request. */
  user: User;
  onChange?: () => void;
}

/** Shown from the "cancel my pending request" control (dropdown/FriendsPage) — the outgoing-tab equivalent of RequestsModal's inline cancel button. */
export default class CancelRequestConfirmModal extends Modal<CancelRequestConfirmModalAttrs> {
  loading: boolean = false;

  className() {
    return 'FriendshipConfirmModal Modal--small';
  }

  title(): Mithril.Children {
    return app.translator.trans('forumaker-friendship.forum.cancel_request_modal.title');
  }

  content(): Mithril.Children {
    return (
      <div className="Modal-body">
        <p className="FriendshipConfirmModal-text">
          {app.translator.trans('forumaker-friendship.forum.cancel_request_modal.text', { user: this.attrs.user })}
        </p>
        <div className="FriendshipConfirmModal-actions">
          <Button className="Button Button--danger Button--block" icon="fas fa-ban" loading={this.loading} onclick={() => this.cancel()}>
            {app.translator.trans('forumaker-friendship.forum.cancel_request_modal.confirm_btn')}
          </Button>
          <Button className="Button Button--block" disabled={this.loading} onclick={() => this.hide()}>
            {app.translator.trans('forumaker-friendship.forum.cancel_request_modal.cancel_btn')}
          </Button>
        </div>
      </div>
    );
  }

  async cancel(): Promise<void> {
    const requestId = this.attrs.user.attribute('friendshipPendingOutgoingRequestId') as number | null;
    if (!requestId) {
      this.hide();
      return;
    }

    this.loading = true;
    m.redraw();

    try {
      await app.request({ method: 'DELETE', url: `${app.forum.attribute('apiUrl')}/friendship-requests/${requestId}` });

      this.attrs.user.pushAttributes({ friendshipHasPendingOutgoing: false, friendshipPendingOutgoingRequestId: null });

      this.hide();
      this.attrs.onChange?.();
      app.alerts.show({ type: 'success' }, app.translator.trans('forumaker-friendship.forum.requests_modal.cancel_success'));
    } catch (error) {
      this.loading = false;
      m.redraw();
      throw error;
    }
  }
}
