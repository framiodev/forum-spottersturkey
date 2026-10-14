import app from 'flarum/forum/app';
import Modal, { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';
import type User from 'flarum/common/models/User';

interface AddFriendConfirmModalAttrs extends IInternalModalAttrs {
  user: User;
  onSent?: () => void;
}

export default class AddFriendConfirmModal extends Modal<AddFriendConfirmModalAttrs> {
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
        <p className="FriendshipConfirmModal-text">
          {/* Passing the raw User model under the `user` key is required —
              Translator.preprocessParameters() special-cases that exact key:
              it extracts it and derives a `{username}` placeholder from it
              internally (see Flarum\common\Translator.tsx). Passing an
              already-rendered username() vnode there instead crashes, since
              the translator then tries to call .displayName() on the vnode. */}
          {app.translator.trans('forumaker-friendship.forum.add_modal.text', { user: this.attrs.user })}
        </p>
        <div className="FriendshipConfirmModal-actions">
          <Button className="Button Button--primary Button--block" icon="fas fa-user-plus" loading={this.loading} onclick={() => this.send()}>
            {app.translator.trans('forumaker-friendship.forum.add_modal.confirm_btn')}
          </Button>
          <Button className="Button Button--block" disabled={this.loading} onclick={() => this.hide()}>
            {app.translator.trans('forumaker-friendship.forum.add_modal.cancel_btn')}
          </Button>
        </div>
      </div>
    );
  }

  async send(): Promise<void> {
    this.loading = true;
    m.redraw();

    try {
      const response = await app.request<{ success: boolean; status: 'requested' | 'auto_accepted' }>({
        method: 'POST',
        url: `${app.forum.attribute('apiUrl')}/friendship-requests`,
        body: { recipientId: this.attrs.user.id() },
      });

      this.attrs.user.pushAttributes({
        friendshipHasPendingOutgoing: response.status === 'requested',
        friendshipIsFriend: response.status === 'auto_accepted',
      });

      // Mutual-request auto-accept: a friendship was created immediately,
      // so both friendCount totals need to reflect that right away — no
      // response body carries updated user resources for this endpoint.
      if (response.status === 'auto_accepted') {
        this.attrs.user.pushAttributes({ friendCount: ((this.attrs.user.attribute('friendCount') as number) || 0) + 1 });
        app.session.user?.pushAttributes({ friendCount: ((app.session.user.attribute('friendCount') as number) || 0) + 1 });
      }

      this.hide();
      this.attrs.onSent?.();
      app.alerts.show(
        { type: 'success' },
        app.translator.trans(
          response.status === 'auto_accepted' ? 'forumaker-friendship.forum.requests_modal.accept_success' : 'forumaker-friendship.forum.add_modal.success'
        )
      );
    } catch (error) {
      this.loading = false;
      m.redraw();
      throw error;
    }
  }
}
