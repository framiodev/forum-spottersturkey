import Component, { ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import app from 'flarum/admin/app';
import type Mithril from 'mithril';

export interface DiscoverItem {
  name: string;
  description: string;
  url: string;
  repository: string;
  downloads: number;
  favers: number;
}

export interface DiscoverCardAttrs extends ComponentAttrs {
  item: DiscoverItem;
  onInstall: (packageName: string) => void;
}

export default class DiscoverCard extends Component<DiscoverCardAttrs> {
  view() {
    const { item } = this.attrs;

    return (
      <div className="FramioPackageManager-discoverCard">
        <div>
          <h4>{item.name}</h4>
          <p>{item.description || 'Açıklama bulunmuyor.'}</p>
        </div>

        <div>
          <div className="meta">
            <span>
              <i className="fas fa-download" /> {(item.downloads || 0).toLocaleString()}
            </span>
            <span>
              <i className="fas fa-star" /> {(item.favers || 0).toLocaleString()}
            </span>
            <span>
              <a href={item.repository || item.url} target="_blank" rel="noopener noreferrer">
                <i className="fab fa-github" /> Repo
              </a>
            </span>
          </div>

          <div className="actions">
            <Button
              className="Button Button--primary Button--sm"
              icon="fas fa-layer-group"
              onclick={() => this.attrs.onInstall(item.name)}
            >
              Kur / Konsolide Et
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
