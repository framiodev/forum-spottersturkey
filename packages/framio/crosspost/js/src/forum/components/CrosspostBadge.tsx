import Component from 'flarum/common/Component';
import app from 'flarum/forum/app';
import Icon from 'flarum/common/components/Icon';
import type Mithril from 'mithril';

export interface CrosspostBadgeAttrs {
  post: any;
}

export default class CrosspostBadge extends Component<CrosspostBadgeAttrs> {
  view(): Mithril.Children {
    const post = this.attrs.post;
    if (!post) return null;

    const discussion = post.discussion && typeof post.discussion === 'function' ? post.discussion() : null;

    const platform = post.attribute('crosspostSourcePlatform') || (discussion && discussion.attribute('crosspostSourcePlatform'));
    const author = post.attribute('crosspostSourceAuthor') || (discussion && discussion.attribute('crosspostSourceAuthor')) || 'Anonim';
    const url = post.attribute('crosspostSourceUrl') || (discussion && discussion.attribute('crosspostSourceUrl'));

    if (!platform) {
      return null;
    }

    return (
      <div className="CrosspostAttributionBadge">
        <div className="CrosspostAttributionBadge-main">
          <div className="CrosspostAttributionBadge-icon">
            <Icon name="fas fa-network-wired" />
          </div>
          <div className="CrosspostAttributionBadge-text">
            {app.translator.trans('framio-network-crosspost.forum.attribution_prefix')}{' '}
            <strong>{author}</strong>{' '}
            {app.translator.trans('framio-network-crosspost.forum.attribution_by')}{' '}
            <span className="CrosspostAttributionBadge-platform">{platform}</span>{' '}
            {app.translator.trans('framio-network-crosspost.forum.attribution_on')}
          </div>
        </div>
        {url && (
          <div className="CrosspostAttributionBadge-action">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="Button Button--primary"
            >
              <Icon name="fas fa-external-link-alt" />
              <span>{app.translator.trans('framio-network-crosspost.forum.view_original')}</span>
            </a>
          </div>
        )}
      </div>
    );
  }
}
