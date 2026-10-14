import type Mithril from 'mithril';
import Component, { ComponentAttrs } from 'flarum/common/Component';
import extract from 'flarum/common/utils/extract';
import Icon from 'flarum/common/components/Icon';

export interface UsercardStatAttrs extends ComponentAttrs {
  icon: string;
  displayText: string;
}

export default class UsercardStat<T extends UsercardStatAttrs = UsercardStatAttrs> extends Component<T> {
  view(vnode: Mithril.Vnode) {
    const attrs = Object.assign({}, this.attrs);

    const iconClass = extract(attrs, 'icon');
    const displayText = extract(attrs, 'displayText');

    return (
      <div className="userStat">
        <Icon name={iconClass} />
        {displayText}
      </div>
    );
  }
}
