import app from 'flarum/forum/app';
import Modal, { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Avatar from 'flarum/common/components/Avatar';
import humanTime from 'flarum/common/helpers/humanTime';
import type Mithril from 'mithril';
import type User from 'flarum/common/models/User';
import type { FriendshipEvent } from '../../common';

interface HistoryModalAttrs extends IInternalModalAttrs {
  user: User;
}

function historyText(event: FriendshipEvent, viewedUser: User): Mithril.Children {
  const actor = event.actor();
  const other = event.otherUser();
  if (!other) return '?';

  const isSelf = actor && viewedUser && actor.id() === viewedUser.id();
  const key = `forumaker-friendship.forum.history.${event.action()}_${isSelf ? 'self' : 'other'}`;

  // Raw User model under `user` — Translator.preprocessParameters() special-cases
  // that exact key and derives a `{username}` placeholder from it internally
  // (see AddFriendConfirmModal's identical comment for the full explanation).
  return app.translator.trans(key, { user: other });
}

export default class HistoryModal extends Modal<HistoryModalAttrs> {
  loading: boolean = true;
  loadingMore: boolean = false;
  events: FriendshipEvent[] = [];
  total: number = 0;
  hasMore: boolean = false;

  className() {
    return 'FriendshipHistoryModal Modal--medium';
  }

  title(): Mithril.Children {
    return (
      <>
        <i className="fas fa-history" /> {app.translator.trans('forumaker-friendship.forum.history_modal.title')}
      </>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<HistoryModalAttrs, this>) {
    super.oncreate(vnode);
    this.load();
  }

  async load(loadMore: boolean = false): Promise<void> {
    if (loadMore) {
      this.loadingMore = true;
    } else {
      this.loading = true;
      this.events = [];
    }
    m.redraw();

    try {
      const results = await app.store.find<FriendshipEvent[]>('friendship-events', {
        filter: { user: this.attrs.user.id() },
        include: 'otherUser,actor',
        page: { offset: loadMore ? this.events.length : 0, limit: 20 },
      });
      const newEvents = results as unknown as FriendshipEvent[];

      this.events = loadMore ? [...this.events, ...newEvents] : newEvents;

      const meta = (results as unknown as { payload?: { meta?: any } }).payload?.meta;
      this.total = meta?.page?.total ?? meta?.total ?? this.events.length;
      this.hasMore = this.events.length < this.total;
    } finally {
      this.loading = false;
      this.loadingMore = false;
      m.redraw();
    }
  }

  content(): Mithril.Children {
    if (this.loading) {
      return (
        <div className="Modal-body">
          <LoadingIndicator />
        </div>
      );
    }

    return (
      <div className="Modal-body">
        {this.events.length === 0 ? (
          <p className="FriendshipHistoryModal-empty">{app.translator.trans('forumaker-friendship.forum.history_modal.empty')}</p>
        ) : (
          <ul className="FriendshipHistoryModal-list">
            {this.events.map((event) => {
              const other = event.otherUser();
              return (
                <li className="FriendshipHistoryModal-item" key={event.id()}>
                  {other && <Avatar user={other} />}
                  <div className="FriendshipHistoryModal-itemContent">
                    <span className="FriendshipHistoryModal-text">{historyText(event, this.attrs.user)}</span>
                    <span className="FriendshipHistoryModal-date">{humanTime(event.createdAt())}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {this.hasMore && (
          <div className="FriendshipHistoryModal-loadMore">
            <Button className="Button" loading={this.loadingMore} onclick={() => this.load(true)}>
              {app.translator.trans('forumaker-friendship.forum.history_modal.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }
}
