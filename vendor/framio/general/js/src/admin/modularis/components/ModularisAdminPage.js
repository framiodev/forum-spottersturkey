import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import Button from 'flarum/common/components/Button';
import StyleModal from './StyleModal';
import ConfirmModal from './ConfirmModal';
import ExportModal from './ExportModal';
import StyleListItem from './StyleListItem';

const PREFIX = 'stezkoy-modularis.admin.';

function styleId(style) {
  return typeof style.id === 'function' ? style.id() : style.id;
}

export default class ModularisAdminPage extends ExtensionPage {
  oninit(vnode) {
    super.oninit(vnode);

    this.styles = [];
    this.loading = true;
    this.savingId = null;

    this.refresh();
  }

  content(vnode) {
    return m(
      '.ExtensionPage-settings',
      m(
        '.container',
        m('div.ModularisAdmin', [
          this.helpBlock(),
          this.toolbar(),
          m('input.ModularisAdmin-importInput', {
            type: 'file',
            accept: '.json,application/json',
            onchange: this.onImportFile.bind(this),
          }),
          this.stylesSection('forum', 'forum_section', 'forum_section_help'),
          this.stylesSection('admin', 'admin_section', 'admin_section_help'),
        ])
      )
    );
  }

  helpBlock() {
    return m('.ModularisAdmin-help', app.translator.trans(PREFIX + 'help_block'));
  }

  toolbar() {
    return m('.ModularisAdmin-toolbar', [
      m(
        Button,
        {
          className: 'Button Button--primary',
          icon: 'fas fa-download',
          onclick: this.exportStyles.bind(this),
        },
        app.translator.trans(PREFIX + 'export_button')
      ),
      m(
        Button,
        {
          className: 'Button Button--primary',
          icon: 'fas fa-upload',
          onclick: this.pickImportFile.bind(this),
        },
        app.translator.trans(PREFIX + 'import_button')
      ),
      m(
        Button,
        {
          className: 'Button Button--primary',
          icon: 'fas fa-eraser',
          onclick: this.clearCache.bind(this),
        },
        app.translator.trans(PREFIX + 'clear_cache_button')
      ),
    ]);
  }

  pickImportFile() {
    this.$('.ModularisAdmin-importInput').click();
  }

  onImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      e.target.value = '';
      this.importStyles(reader.result);
    };
    reader.readAsText(file);
  }

  exportStyles() {
    app.modal.show(ExportModal, {
      styles: this.styles,
      onexport: this.downloadExport.bind(this),
    });
  }

  downloadExport(selectedStyles) {
    try {
      const data = JSON.stringify(
        {
          version: 1,
          styles: selectedStyles.map((style) => ({
            name: style.name(),
            css: style.css(),
            scope: style.scope(),
            active: style.active(),
            sortOrder: style.sortOrder(),
          })),
        },
        null,
        2
      );

      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.exportFileName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      app.alerts.show({ type: 'success' }, app.translator.trans(PREFIX + 'export_success'));
    } catch (err) {
      app.alerts.show({ type: 'error' }, app.translator.trans(PREFIX + 'export_failed'));
    }
  }

  exportFileName() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp =
      d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
    return 'modularis-' + stamp + '.json';
  }

  importStyles(raw) {
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      payload = null;
    }

    const styles = Array.isArray(payload && payload.styles) ? payload.styles : null;
    if (!styles) {
      app.alerts.show({ type: 'error' }, app.translator.trans(PREFIX + 'import_invalid'));
      return;
    }

    const { enabled, disabled } = styles.reduce(
      (acc, s) => {
        const valid = s && typeof s.name === 'string' && typeof s.css === 'string';
        acc[valid ? 'enabled' : 'disabled'].push(s);
        return acc;
      },
      { enabled: [], disabled: [] }
    );

    if (!enabled.length) {
      app.alerts.show({ type: 'error' }, app.translator.trans(PREFIX + 'import_invalid'));
      return;
    }

    app.modal.show(ConfirmModal, {
      title: app.translator.trans(PREFIX + 'import_button'),
      message: app.translator.trans(PREFIX + 'import_confirm', { count: enabled.length }),
      confirmLabel: app.translator.trans(PREFIX + 'import_confirm_button'),
      onconfirm: () => this.persistImport(enabled),
    });
  }

  persistImport(styles) {
    const validScopes = ['forum', 'admin'];

    const toData = (style) => {
      const scope = validScopes.includes(style.scope) ? style.scope : 'forum';
      return {
        name: style.name,
        css: style.css,
        scope,
        active: style.active === true,
        sortOrder: typeof style.sortOrder === 'number' ? style.sortOrder : 0,
      };
    };

    const create = (style) => {
      const record = app.store.createRecord('modularis-styles', toData(style));
      return record.save(toData(style), { errorHandler: () => {} });
    };

    Promise.all(styles.map(create))
      .then(() => {
        app.alerts.show({ type: 'success' }, app.translator.trans(PREFIX + 'import_success', { count: styles.length }));
        this.refresh();
      })
      .catch((e) => {
        const errors = (e && e.response && e.response.errors) || [];
        const detail =
          errors.length
            ? `${app.translator.trans(PREFIX + 'import_failed')} — ${errors[0].detail || errors[0].status}`
            : app.translator.trans(PREFIX + 'import_failed');
        app.alerts.show({ type: 'error' }, detail);
        this.refresh();
      });
  }

  stylesSection(scope, titleKey, helpKey) {
    const sectionStyles = this.styles.filter((style) => style.scope() === scope);
    const total = sectionStyles.length;
    const enabled = sectionStyles.filter((style) => style.active()).length;

    return m('section.ModularisAdmin-section', [
      m('.ModularisAdmin-sectionHeader', [
        m('.ModularisAdmin-sectionHeader-text', [
          m('h3', [
            app.translator.trans(PREFIX + titleKey),
            total
              ? m('span.ModularisAdmin-sectionCounter', app.translator.trans(PREFIX + 'section_counter', { enabled, total }))
              : null,
          ]),
          m('p.helpText', app.translator.trans(PREFIX + helpKey)),
        ]),
        m(
          Button,
          {
            className: 'Button Button--primary',
            icon: 'fas fa-plus',
            onclick: () => this.openModal(null, scope),
          },
          app.translator.trans(PREFIX + 'add_button')
        ),
      ]),

      this.loading
        ? m('.ModularisAdmin-loading', m('span.LoadingIndicator'))
        : sectionStyles.length
        ? m(
            'ul.ModularisStyleList',
            sectionStyles.map((style) =>
              m(StyleListItem, {
                key: styleId(style),
                style,
                loading: this.savingId === styleId(style),
                ontoggle: this.toggleStyle.bind(this),
                onedit: this.edit.bind(this),
                ondelete: this.delete.bind(this),
              })
            )
          )
        : m('.ModularisAdmin-empty', app.translator.trans(PREFIX + 'empty')),
    ]);
  }

  refresh() {
    this.loading = true;
    m.redraw();

    return app.store
      .find('modularis-styles')
      .then((styles) => {
        this.styles = styles;
        this.loading = false;
        m.redraw();
      })
      .catch(() => {
        this.loading = false;
        app.alerts.show({ type: 'error' }, app.translator.trans(PREFIX + 'load_error'));
        m.redraw();
      });
  }

  openModal(style, scope) {
    app.modal.show(StyleModal, {
      style,
      scope,
      ondone: this.refresh.bind(this),
    });
  }

  edit(style) {
    this.openModal(style, style.scope());
  }

  toggleStyle(style, value) {
    this.savingId = styleId(style);

    if (typeof style.save !== 'function') {
      app.alerts.show({ type: 'error' }, app.translator.trans(PREFIX + 'request_error'));
      m.redraw();
      return;
    }

    style
      .save({ active: value })
      .then(() => {
        this.savingId = null;
        m.redraw();
      })
      .catch((e) => {
        this.savingId = null;
        const errors = (e && e.response && e.response.errors) || [];
        const detail = errors[0] ? errors[0].detail : null;
        app.alerts.show({ type: 'error' }, detail || app.translator.trans(PREFIX + 'request_error'));
        m.redraw();
      });
  }

  delete(style) {
    app.modal.show(ConfirmModal, {
      title: app.translator.trans(PREFIX + 'delete_button'),
      message: app.translator.trans(PREFIX + 'confirm_delete', { name: style.name() }),
      onconfirm: () => style.delete().then(this.refresh.bind(this)),
    });
  }

  clearCache() {
    app
      .request({
        method: 'DELETE',
        url: app.forum.attribute('apiUrl') + '/cache',
      })
      .then(() => {
        app.alerts.show({ type: 'success' }, app.translator.trans(PREFIX + 'cache_cleared'));
      })
      .catch(() => {
        app.alerts.show({ type: 'error' }, app.translator.trans(PREFIX + 'clear_cache_failed'));
      });
  }
}
