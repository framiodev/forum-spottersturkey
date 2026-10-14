import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';

const PREFIX = 'stezkoy-modularis.admin.';

export default class ConfirmModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);
    this.loading = false;
  }

  className() {
    return 'ConfirmModal Modal--small';
  }

  title() {
    return this.attrs.title || '';
  }

  content() {
    return m('div.Modal-body', [
      m('p.ConfirmModal-message', this.attrs.message),
      m('.Form-group.Form-controls', [
        m(
          Button,
          {
            className: 'Button Button--primary',
            loading: this.loading,
            disabled: this.loading,
            onclick: () => this.confirm(),
          },
          this.attrs.confirmLabel || app.translator.trans(PREFIX + 'delete_button')
        ),
        m(
          Button,
          {
            className: 'Button',
            disabled: this.loading,
            onclick: () => this.hide(),
          },
          this.attrs.cancelLabel || app.translator.trans(PREFIX + 'cancel_button')
        ),
      ]),
    ]);
  }

  confirm() {
    if (this.loading) {
      return;
    }

    this.loading = true;

    Promise.resolve(this.attrs.onconfirm && this.attrs.onconfirm()).then(() => {
      this.loading = false;
      m.redraw();
      this.hide();
    });
  }
}
