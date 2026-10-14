import app from 'flarum/forum/app';
import Component, { ComponentAttrs } from 'flarum/common/Component';
import Dropdown from 'flarum/common/components/Dropdown';
import Link from 'flarum/common/components/Link';
import Avatar from 'flarum/common/components/Avatar';
import username from 'flarum/common/helpers/username';
import humanTime from 'flarum/common/helpers/humanTime';
import classList from 'flarum/common/utils/classList';
import SubtreeRetainer from 'flarum/common/utils/SubtreeRetainer';
import WarningPost from './WarningPost';
import WarningControls from './WarningControls';
import type Warning from '../model/Warning';
import type Mithril from 'mithril';

export interface IWarningListItemAttrs extends ComponentAttrs {
  warning: Warning;
  ondelete?: (warning: Warning) => void;
  onchange?: (warning: Warning) => void;
}

export default class WarningListItem<CustomAttrs extends IWarningListItemAttrs = IWarningListItemAttrs> extends Component<CustomAttrs> {
  subtree!: SubtreeRetainer;

  oninit(vnode: Mithril.Vnode<CustomAttrs, this>) {
    super.oninit(vnode);

    this.subtree = new SubtreeRetainer(
      () => this.attrs.warning.freshness,
      () => this.attrs.warning.isHidden()
    );
  }

  onbeforeupdate(vnode: Mithril.VnodeDOM<CustomAttrs, this>) {
    super.onbeforeupdate(vnode);

    return this.subtree.needsRebuild();
  }

  view() {
    const { warning } = this.attrs;
    const addedByUser = warning.addedByUser();
    const post = warning.post();
    const controls = WarningControls.controls(warning, this).toArray();

    return (
      <div {...this.elementAttrs()}>
        {Dropdown.component(
          {
            icon: 'fas fa-ellipsis-v',
            className: classList('WarningListItem-controls', { hidden: !controls.length }),
            buttonClassName: 'Button Button--icon Button--flat Slidable-underneath Slidable-underneath--right',
          },
          controls
        )}
        <div className="WarningListItem-main">
          <h3 className="WarningListItem-title">
            <Link href={addedByUser ? app.route.user(addedByUser) : '#'} className="WarningListItem-author">
              <Avatar user={addedByUser || null} /> {username(addedByUser)}
            </Link>
          </h3>
          <span className="WarningListItem-strikes">
            {warning.isHidden()
              ? app.translator.trans('fof-moderator-warnings.forum.warning_list_item.list_item_heading_hidden', {
                  time: humanTime(warning.createdAt()),
                  strikes: warning.strikes() || 0,
                })
              : app.translator.trans('fof-moderator-warnings.forum.warning_list_item.list_item_heading', {
                  time: humanTime(warning.createdAt()),
                  strikes: warning.strikes() || 0,
                })}
          </span>
          <hr />
          <ul className="WarningListItem-info">
            {post ? (
              <li className="item-excerpt">
                <h3 className="WarningListItem-subtitle">{app.translator.trans('fof-moderator-warnings.forum.warning_list_item.linked_post')}</h3>
                {WarningPost.component({ post })}
              </li>
            ) : (
              ''
            )}
            <li className="item-excerpt">
              <h3 className="WarningListItem-subtitle">{app.translator.trans('fof-moderator-warnings.forum.warning_list_item.public_comment')}</h3>
              <p className="WarningListItem-comment">{m.trust(warning.publicComment())}</p>
            </li>
            {app.session.user?.canManageWarnings() && warning.privateComment() ? (
              <li className="item-excerpt">
                <h3 className="WarningListItem-subtitle">{app.translator.trans('fof-moderator-warnings.forum.warning_list_item.private_comment')}</h3>
                <p className="WarningListItem-comment">{m.trust(warning.privateComment()!)}</p>
              </li>
            ) : (
              ''
            )}
          </ul>
        </div>
      </div>
    );
  }

  elementAttrs(): ComponentAttrs {
    const { warning } = this.attrs;

    return {
      className: classList({
        WarningListItem: true,
        'WarningListItem--hidden': warning.isHidden(),
      }),
    };
  }
}
