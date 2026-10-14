import Component, { ComponentAttrs } from 'flarum/common/Component';
import PostWarning from './PostWarning';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

export interface IPostWarningListAttrs extends ComponentAttrs {
  post: Post;
}

export default class PostWarningList<CustomAttrs extends IPostWarningListAttrs = IPostWarningListAttrs> extends Component<CustomAttrs> {
  post!: Post;

  oninit(vnode: Mithril.Vnode<CustomAttrs, this>) {
    super.oninit(vnode);

    this.post = this.attrs.post;
  }

  view() {
    return (
      <div className="Post-warning-list">
        {(this.attrs.post.warnings() || []).filter(Boolean).map((warning) => {
          return PostWarning.component({ warning });
        })}
      </div>
    );
  }
}
