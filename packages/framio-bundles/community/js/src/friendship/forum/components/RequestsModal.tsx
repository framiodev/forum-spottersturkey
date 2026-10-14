import app from 'flarum/forum/app';
import Modal, { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import username from 'flarum/common/helpers/username';
import humanTime from 'flarum/common/helpers/humanTime';
import type Mithril from 'mithril';
import type User from 'flarum/common/models/User';
import type { FriendshipRequest } from '../../common';
import HistoryModal from './HistoryModal';

interface RequestsModalAttrs extends IInternalModalAttrs {
  user: User;
  onChange?: () => void;
  /** Scrolls to and highlights this request on open — see notification click-through. */
  highlightRequestId?: string;
}

type Direction = 'incoming' | 'outgoing';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 700;

interface DirectionState {
  items: FriendshipRequest[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  search: string;
  searchTimer: number | null;
}

function emptyState(): DirectionState {
  return { items: [], total: 0, loading: true, loadingMore: false, hasMore: false, search: '', searchTimer: null };
}

export default class RequestsModal extends Modal<RequestsModalAttrs> {
  activeTab: Direction = 'incoming';
  busyId: string | null = null;
  highlighted: string | null = null;

  state: Record<Direction, DirectionState> = { incoming: emptyState(), outgoing: emptyState() };

  className() {
    return 'FriendshipRequestsModal Modal--medium';
  }

  title(): Mithril.Children {
    return (
      <>
        <i className="fas fa-user-clock" /> {app.translator.trans('forumaker-friendship.forum.requests_modal.title')}
      </>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<RequestsModalAttrs, this>) {
    super.oncreate(vnode);
    this.highlighted = this.attrs.highlightRequestId ?? null;
    this.load('incoming').then(() => this.scrollToHighlighted());
    this.load('outgoing');
  }

  scrollToHighlighted(): void {
    if (!this.highlighted) return;

    setTimeout(() => {
      this.element?.querySelector?.(`[data-request-id="${this.highlighted}"]`)?.scrollIntoView({ block: 'center' });
    }, 50);
  }

  async load(direction: Direction, loadMore: boolean = false): Promise<void> {
    const state = this.state[direction];

    if (loadMore) {
      state.loadingMore = true;
    } else {
      state.loading = true;
    }
    m.redraw();

    try {
      const filter: Record<string, unknown> = { [direction]: this.attrs.user.id() };
      if (state.search.trim()) filter.q = state.search.trim();

      const results = await app.store.find<FriendshipRequest[]>('friendship-requests', {
        filter,
        include: 'sender,recipient',
        page: { offset: loadMore ? state.items.length : 0, limit: PAGE_SIZE },
      });
      const newItems = results as unknown as FriendshipRequest[];

      state.items = loadMore ? [...state.items, ...newItems] : newItems;

      const meta = (results as unknown as { payload?: { meta?: any } }).payload?.meta;
      state.total = meta?.page?.total ?? meta?.total ?? state.items.length;
      state.hasMore = state.items.length < state.total;
    } finally {
      state.loadingMore = false;
      state.loading = false;
      m.redraw();
    }
  }

  search(direction: Direction, value: string): void {
    const state = this.state[direction];
    state.search = value;

    if (state.searchTimer) window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => this.load(direction), SEARCH_DEBOUNCE_MS);
  }

  content(): Mithril.Children {
    const state = this.state[this.activeTab];

    return (
      <div className="Modal-body">
        <div className="FriendshipRequestsModal-toolbar">
          <div className="FriendshipRequestsModal-tabGroup">
            <Button
              className={'Button FriendshipRequestsModal-tab' + (this.activeTab === 'incoming' ? ' active' : '')}
              onclick={() => (this.activeTab = 'incoming')}
            >
              {app.translator.trans('forumaker-friendship.forum.requests_modal.incoming_tab', { count: this.state.incoming.total })}
            </Button>
            <Button
              className={'Button FriendshipRequestsModal-tab' + (this.activeTab === 'outgoing' ? ' active' : '')}
              onclick={() => (this.activeTab = 'outgoing')}
            >
              {app.translator.trans('forumaker-friendship.forum.requests_modal.outgoing_tab', { count: this.state.outgoing.total })}
            </Button>
          </div>

          <input
            type="text"
            className="FormControl FriendshipRequestsModal-search"
            placeholder={String(app.translator.trans('forumaker-friendship.forum.requests_modal.search_placeholder'))}
            value={state.search}
            oninput={(e: InputEvent) => this.search(this.activeTab, (e.target as HTMLInputElement).value)}
          />

          <Button
            className="Button FriendshipRequestsModal-historyBtn"
            icon="fas fa-history"
            onclick={() => app.modal.show(HistoryModal, { user: this.attrs.user })}
          >
            {app.translator.trans('forumaker-friendship.forum.requests_modal.history_btn')}
          </Button>
        </div>

        {state.loading ? <LoadingIndicator /> : this.renderTab(this.activeTab)}
      </div>
    );
  }

  renderTab(direction: Direction): Mithril.Children {
    const state = this.state[direction];

    return (
      <div>
        {state.items.length === 0 ? (
          <p className="FriendshipRequestsModal-empty">
            {app.translator.trans(
              direction === 'incoming' ? 'forumaker-friendship.forum.requests_modal.no_incoming' : 'forumaker-friendship.forum.requests_modal.no_outgoing'
            )}
          </p>
        ) : (
          <ul className="FriendshipRequestsModal-list">{direction === 'incoming' ? this.renderIncomingItems() : this.renderOutgoingItems()}</ul>
        )}

        {state.hasMore && (
          <div className="FriendshipRequestsModal-loadMore">
            <Button className="Button" loading={state.loadingMore} onclick={() => this.load(direction, true)}>
              {app.translator.trans('forumaker-friendship.forum.user.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  renderIncomingItems(): Mithril.Children {
    return this.state.incoming.items.map((request) => {
      const sender = request.sender();
      if (!sender) return null;
      const busy = this.busyId === request.id();

      return (
        <li className="FriendshipRequestsModal-item" data-request-id={request.id()} key={request.id()}>
          <Link href={app.route.user(sender)}>
            <Avatar user={sender} />
          </Link>
          <div className="FriendshipRequestsModal-itemContent">
            <Link href={app.route.user(sender)}>{username(sender)}</Link>
            <span className="FriendshipRequestsModal-date">{humanTime(request.createdAt())}</span>
          </div>
          <div className="FriendshipRequestsModal-itemActions">
            <Button className="Button Button--primary" icon="fas fa-check" loading={busy} disabled={busy} onclick={() => this.accept(request)}>
              {app.translator.trans('forumaker-friendship.forum.requests_modal.accept_btn')}
            </Button>
            <Button className="Button" icon="fas fa-times" disabled={busy} onclick={() => this.decline(request)}>
              {app.translator.trans('forumaker-friendship.forum.requests_modal.decline_btn')}
            </Button>
          </div>
        </li>
      );
    });
  }

  renderOutgoingItems(): Mithril.Children {
    return this.state.outgoing.items.map((request) => {
      const recipient = request.recipient();
      if (!recipient) return null;
      const busy = this.busyId === request.id();

      return (
        <li className="FriendshipRequestsModal-item" key={request.id()}>
          <Link href={app.route.user(recipient)}>
            <Avatar user={recipient} />
          </Link>
          <div className="FriendshipRequestsModal-itemContent">
            <Link href={app.route.user(recipient)}>{username(recipient)}</Link>
            <span className="FriendshipRequestsModal-date">{humanTime(request.createdAt())}</span>
          </div>
          <div className="FriendshipRequestsModal-itemActions">
            <Button className="Button" icon="fas fa-ban" loading={busy} disabled={busy} onclick={() => this.cancel(request)}>
              {app.translator.trans('forumaker-friendship.forum.requests_modal.cancel_btn')}
            </Button>
          </div>
        </li>
      );
    });
  }

  async accept(request: FriendshipRequest): Promise<void> {
    this.busyId = request.id();
    m.redraw();

    try {
      await app.request({ method: 'POST', url: `${app.forum.attribute('apiUrl')}/friendship-requests/${request.id()}/accept` });

      const state = this.state.incoming;
      state.items = state.items.filter((r) => r.id() !== request.id());
      state.total = Math.max(0, state.total - 1);

      // No response body carries updated user resources for this endpoint —
      // both sides' friendCount are bumped locally instead.
      const sender = request.sender();
      sender?.pushAttributes({
        friendshipIsFriend: true,
        friendCount: ((sender.attribute('friendCount') as number) || 0) + 1,
      });
      this.attrs.user.pushAttributes({
        friendCount: ((this.attrs.user.attribute('friendCount') as number) || 0) + 1,
        friendshipIncomingRequestCount: Math.max(0, ((this.attrs.user.attribute('friendshipIncomingRequestCount') as number) || 0) - 1),
      });

      app.alerts.show({ type: 'success' }, app.translator.trans('forumaker-friendship.forum.requests_modal.accept_success'));
      this.attrs.onChange?.();
    } finally {
      this.busyId = null;
      m.redraw();
    }
  }

  async decline(request: FriendshipRequest): Promise<void> {
    this.busyId = request.id();
    m.redraw();

    try {
      await app.request({ method: 'POST', url: `${app.forum.attribute('apiUrl')}/friendship-requests/${request.id()}/decline` });

      const state = this.state.incoming;
      state.items = state.items.filter((r) => r.id() !== request.id());
      state.total = Math.max(0, state.total - 1);

      this.attrs.user.pushAttributes({
        friendshipIncomingRequestCount: Math.max(0, ((this.attrs.user.attribute('friendshipIncomingRequestCount') as number) || 0) - 1),
      });

      this.attrs.onChange?.();
    } finally {
      this.busyId = null;
      m.redraw();
    }
  }

  async cancel(request: FriendshipRequest): Promise<void> {
    this.busyId = request.id();
    m.redraw();

    try {
      await request.delete();

      const state = this.state.outgoing;
      state.items = state.items.filter((r) => r.id() !== request.id());
      state.total = Math.max(0, state.total - 1);

      app.alerts.show({ type: 'success' }, app.translator.trans('forumaker-friendship.forum.requests_modal.cancel_success'));
      this.attrs.onChange?.();
    } finally {
      this.busyId = null;
      m.redraw();
    }
  }
}
