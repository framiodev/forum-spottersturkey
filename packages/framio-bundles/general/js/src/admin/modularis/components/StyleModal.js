import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import extractText from 'flarum/common/utils/extractText';

const PREFIX = 'stezkoy-modularis.admin.';

export default class StyleModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);

    this.style = this.attrs.style || null;
    this.scope = this.attrs.scope;

    this.name = this.style ? this.style.name() : '';
    this.css = this.style ? this.style.css() : '';
    this.errors = {};
    this.loading = false;
  }

  className() {
    return 'ModularisStyleModal Modal--medium';
  }

  title() {
    return app.translator.trans(PREFIX + (this.style ? 'modal_title_edit' : 'modal_title_create'));
  }

  content() {
    return m('div.Modal-body', [
      m(
        'form.ModularisStyleForm',
        {
          onsubmit: this.onsubmit.bind(this),
        },
        [
          m('.Form-group', [
            m('label', app.translator.trans(PREFIX + 'name_label')),
            m('input.FormControl', {
              type: 'text',
              className: this.errors.name ? 'invalid' : '',
              placeholder: extractText(app.translator.trans(PREFIX + 'name_placeholder')),
              value: this.name,
              oninput: (e) => {
                this.name = e.target.value;
                this.errors.name = null;
              },
            }),
            m('p.helpText', app.translator.trans(PREFIX + 'name_help')),
            this.errors.name ? m('.Form-error', this.errors.name) : null,
          ]),

          m('.Form-group', [
            m('label', app.translator.trans(PREFIX + 'css_label')),
            m('textarea.FormControl.ModularisStyleForm-css', {
              className: this.errors.css ? 'invalid' : '',
              placeholder: extractText(app.translator.trans(PREFIX + 'css_placeholder')),
              rows: 10,
              spellcheck: false,
              value: this.css,
              oninput: (e) => {
                this.css = e.target.value;
                this.errors.css = null;
              },
            }),
            m('p.helpText', app.translator.trans(PREFIX + 'css_help')),
            this.errors.css ? m('.Form-error', this.errors.css) : null,
          ]),

          m('.Form-group.Form-controls', [
            m(
              Button,
              {
                className: 'Button Button--primary',
                type: 'submit',
                loading: this.loading,
                disabled: this.loading,
              },
              app.translator.trans(PREFIX + 'save_button')
            ),
            m(
              Button,
              {
                className: 'Button',
                disabled: this.loading,
                onclick: () => this.hide(),
              },
              app.translator.trans(PREFIX + 'cancel_button')
            ),
          ]),
        ]
      ),
    ]);
  }

  onsubmit(e) {
    e.preventDefault();

    if (this.loading) {
      return;
    }

    this.loading = true;
    this.errors = {};

    const data = {
      name: this.name,
      css: this.css,
      scope: this.scope,
    };

    let request;

    const options = { errorHandler: () => {} };

    if (this.style) {
      request = this.style.save(data, options);
    } else {
      const record = app.store.createRecord('modularis-styles', {
        ...data,
        active: false,
      });
      request = record.save(data, options);
    }

    request
      .then(() => {
        this.loading = false;
        m.redraw();
        this.hide();

        if (typeof this.attrs.ondone === 'function') {
          this.attrs.ondone();
        }
      })
      .catch((e) => {
        this.loading = false;
        this.handleErrors(e);
        m.redraw();
      });
  }

  handleErrors(e) {
    const errors = (e && e.response && e.response.errors) || [];

    errors.forEach((err) => {
      const pointer = ((err.source && err.source.pointer) || err.pointer || '').split('/').pop();

      if (pointer === 'name' || pointer === 'css') {
        this.errors[pointer] = err.detail || app.translator.trans(PREFIX + 'request_error');
      }
    });

    const first = errors[0] && errors[0].detail;
    app.alerts.show({ type: 'error' }, first || app.translator.trans(PREFIX + 'request_error'));
  }
}
