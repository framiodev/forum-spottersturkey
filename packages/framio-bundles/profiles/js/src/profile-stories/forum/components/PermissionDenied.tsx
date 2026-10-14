import Component, { ComponentAttrs } from 'flarum/common/Component';
import Mithril from 'mithril';
import app from 'flarum/forum/app';

export default class PermissionDenied extends Component {
  oninit(vnode: Mithril.Vnode<ComponentAttrs, this>) {
    super.oninit(vnode);
  }

  view(vnode: Mithril.Vnode<ComponentAttrs, this>): Mithril.Children {
    return (
      <div className="permission-denied-container">
        <div className="permission-denied-content">{app.translator.trans('justoverclock-profile-stories.forum.youDontHavePermission')}</div>
      </div>
    );
  }
}
