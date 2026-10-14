import Component, { ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import app from 'flarum/admin/app';
import type Mithril from 'mithril';

export interface IsolatedData {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  icon: { name: string; backgroundColor: string; color: string };
  authors: Array<{ name: string; homepage?: string }>;
  path: string;
}

export interface IsolatedCardAttrs extends ComponentAttrs {
  item: IsolatedData;
}

export default class IsolatedCard extends Component<IsolatedCardAttrs> {
  view() {
    const { item } = this.attrs;
    const authorName = item.authors?.[0]?.name || 'Framio-Dev';

    return (
      <div className="FramioPackageManager-isolatedCard">
        <div className="FramioPackageManager-isolatedCard-header">
          <div
            className="icon"
            style={{
              backgroundColor: item.icon?.backgroundColor || '#198754',
              color: item.icon?.color || '#fff',
            }}
          >
            <i className={item.icon?.name || 'fas fa-shield-alt'} />
          </div>
          <div>
            <h4>{item.title}</h4>
            <div className="name">{item.name}</div>
          </div>
        </div>

        <div className="FramioPackageManager-isolatedCard-body">
          {item.description}
        </div>

        <div className="FramioPackageManager-isolatedCard-footer">
          <div>
            <i className="fas fa-code-branch" /> v{item.version}
          </div>
          <div>
            <i className="fas fa-user-edit" /> {authorName}
          </div>
        </div>
      </div>
    );
  }
}
