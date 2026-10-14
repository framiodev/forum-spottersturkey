import app from 'flarum/forum/app';
import Component, { ComponentAttrs } from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import WarningListItem from './WarningListItem';
import type Warning from '../model/Warning';
import type Mithril from 'mithril';

export interface IWarningPreviewAttrs extends ComponentAttrs {
  warning: Warning;
}

export default class WarningPreview<CustomAttrs extends IWarningPreviewAttrs = IWarningPreviewAttrs> extends Component<CustomAttrs> {
  warning!: Warning;

  oninit(vnode: Mithril.Vnode<CustomAttrs, this>) {
    super.oninit(vnode);

    this.warning = this.attrs.warning;
  }

  view() {
    const warnedUser = this.warning.warnedUser();

    return (
      <Link
        className="WarningPreview"
        href={
          warnedUser
            ? app.route('user.warnings', {
                username: warnedUser.username(),
              })
            : '#'
        }
      >
        <WarningListItem warning={this.warning}></WarningListItem>
      </Link>
    );
  }
}
