import Component, { ComponentAttrs } from 'flarum/common/Component';
import PostPreview from 'flarum/forum/components/PostPreview';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

export interface IWarningPostAttrs extends ComponentAttrs {
  post: Post;
}

export default class WarningPost<CustomAttrs extends IWarningPostAttrs = IWarningPostAttrs> extends Component<CustomAttrs> {
  view() {
    return (
      <div className="WarningPost">
        <ul className="Dropdown-menu PostPreview-preview fade in">
          <li>{PostPreview.component({ post: this.attrs.post })}</li>
        </ul>
      </div>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<CustomAttrs, this>) {
    super.oncreate(vnode);

    this.$('.PostPreview-preview').show().css('position', 'relative');
  }
}
