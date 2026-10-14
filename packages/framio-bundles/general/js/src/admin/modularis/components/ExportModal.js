import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Checkbox from 'flarum/common/components/Checkbox';

const PREFIX = 'stezkoy-modularis.admin.';

function styleId(style) {
  return typeof style.id === 'function' ? style.id() : style.id;
}

export default class ExportModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);
    this.styles = this.attrs.styles || [];
    this.selected = {};
  }

  className() {
    return 'ModularisExportModal';
  }

  title() {
    return app.translator.trans(PREFIX + 'export_modal_title');
  }

  content() {
    return m('div.Modal-body', [
      m('p.ModularisExportModal-help', app.translator.trans(PREFIX + 'export_modal_help')),
      this.styles.length
        ? m('.ModularisExportModal-actions', [
            m(
              Button,
              {
                className: 'Button',
                icon: 'fas fa-check-double',
                disabled: this.allSelected(),
                onclick: () => this.setAll(true),
              },
              app.translator.trans(PREFIX + 'export_select_all')
            ),
            m(
              Button,
              {
                className: 'Button',
                icon: 'fas fa-undo',
                disabled: this.countSelected() === 0,
                onclick: () => this.setAll(false),
              },
              app.translator.trans(PREFIX + 'export_select_none')
            ),
            m('span.ModularisExportModal-actionsSpacer'),
            m('span.ModularisExportModal-count', app.translator.trans(PREFIX + 'export_modal_count', { count: this.countSelected() })),
          ])
        : null,
      this.styles.length
        ? m('ul.ModularisExportList', this.styles.map((style) => this.checkboxRow(style)))
        : m('.ModularisExportModal-empty', app.translator.trans(PREFIX + 'empty')),
      m('.Form-group.Form-controls', [
        m(
          Button,
          {
            className: 'Button Button--primary',
            disabled: this.styles.length === 0 || !this.countSelected(),
            onclick: () => this.export(),
          },
          app.translator.trans(PREFIX + 'export_selected', { count: this.countSelected() })
        ),
        m(
          Button,
          {
            className: 'Button',
            onclick: () => this.hide(),
          },
          app.translator.trans(PREFIX + 'cancel_button')
        ),
      ]),
    ]);
  }

  checkboxRow(style) {
    const id = styleId(style);
    const checked = !!this.selected[id];

    return m('li.ModularisExportListItem' + (checked ? '.selected' : ''), [
      m(
        Checkbox,
        {
          state: checked,
          onchange: (val) => {
            this.selected[id] = val;
            m.redraw();
          },
        },
        m('.ModularisExportListItem-info', [
          m('span.ModularisExportListItem-name', style.name()),
          m('span.ModularisExportListItem-meta', style.scope()),
        ])
      ),
    ]);
  }

  countSelected() {
    return Object.values(this.selected).filter(Boolean).length;
  }

  allSelected() {
    return this.styles.length > 0 && this.countSelected() === this.styles.length;
  }

  setAll(value) {
    this.styles.forEach((style) => {
      this.selected[styleId(style)] = value;
    });
    m.redraw();
  }

  export() {
    const selectedStyles = this.styles.filter((style) => this.selected[styleId(style)]);
    this.attrs.onexport(selectedStyles);
    this.hide();
  }
}
