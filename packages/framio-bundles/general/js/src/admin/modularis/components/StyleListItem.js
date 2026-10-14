import Component from 'flarum/common/Component';
import Switch from 'flarum/common/components/Switch';
import Button from 'flarum/common/components/Button';
const PREFIX = 'stezkoy-modularis.admin.';

function styleId(style) {
  return typeof style.id === 'function' ? style.id() : style.id;
}

export default class StyleListItem extends Component {
  view() {
    const style = this.attrs.style;
    const loading = this.attrs.loading;

    return m('li.ModularisStyleListItem', [
      m('.ModularisStyleListItem-name', [
        m('span.ModularisStyleListItem-title', [
          style.name(),
          m('span.ModularisStyleListItem-id', '#' + styleId(style)),
        ]),
        m('span.ModularisStyleListItem-css', style.css() || ''),
      ]),
      m('.ModularisStyleListItem-controls', [
        m(
          Switch,
          {
            state: style.active(),
            loading: loading,
            disabled: loading,
            onchange: this.toggle.bind(this),
          },
          ''
        ),
        m(
          Button,
          {
            className: 'Button Button--icon',
            icon: 'fas fa-pencil-alt',
            title: app.translator.trans(PREFIX + 'edit_button'),
            'aria-label': app.translator.trans(PREFIX + 'edit_button'),
            onclick: () => this.attrs.onedit(style),
          }
        ),
        m(
          Button,
          {
            className: 'Button Button--icon Button--danger',
            icon: 'fas fa-trash-alt',
            title: app.translator.trans(PREFIX + 'delete_button'),
            'aria-label': app.translator.trans(PREFIX + 'delete_button'),
            onclick: () => this.attrs.ondelete(style),
          }
        ),
      ]),
    ]);
  }

  toggle(value) {
    this.attrs.ontoggle(this.attrs.style, value);
  }
}
