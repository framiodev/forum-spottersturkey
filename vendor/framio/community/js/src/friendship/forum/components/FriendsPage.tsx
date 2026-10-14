import app from 'flarum/forum/app';
import UserPage from 'flarum/forum/components/UserPage';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Button from 'flarum/common/components/Button';
import Link from 'flarum/common/components/Link';
import Avatar from 'flarum/common/components/Avatar';
import username from 'flarum/common/helpers/username';
import type RequestError from 'flarum/common/utils/RequestError';
import type Mithril from 'mithril';
import type User from 'flarum/common/models/User';
import type { Friendship } from '../../common';
import RequestsModal from './RequestsModal';
import RemoveFriendConfirmModal from './RemoveFriendConfirmModal';
import showFriendActionModal from '../showFriendActionModal';

const SEARCH_DEBOUNCE_MS = 700;

export default class FriendsPage extends UserPage {
  loading: boolean = true;
  loadingMore: boolean = false;
  friends: Friendship[] = [];
  totalCount: number = 0;
  hasMore: boolean = false;
  search: string = '';
  searchTimer: number | null = null;
  friendsHidden: boolean = false;

  oninit(vnode: Mithril.Vnode) {
    super.oninit(vnode);
    this.loadUser(m.route.param('username'));
  }

  show(user: User): void {
    super.show(user);
    this.loadFriends();

    // Click-through from a "friendshipRequested" notification (see that
    // component's href()). Deferred: show() can run inside Mithril's initial
    // render pass, and app.modal.show() there throws "Node is currently
    // being rendered to and thus is locked".
    const requestId = m.route.param('requestId');
    if (requestId && app.session.user?.id() === user.id()) {
      setTimeout(() => this.showRequestsModal(String(requestId)), 0);
    }
  }

  onsearch(value: string): void {
    this.search = value;

    if (this.searchTimer) window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => this.loadFriends(), SEARCH_DEBOUNCE_MS);
  }

  async loadFriends(loadMore: boolean = false): Promise<void> {
    if (!this.user) return;

    if (loadMore) {
      this.loadingMore = true;
    } else {
      this.loading = true;
      this.friends = [];
      this.friendsHidden = false;
    }
    m.redraw();

    try {
      const filter: Record<string, unknown> = { user: this.user.id() };
      if (this.search.trim()) filter.q = this.search.trim();

      const results = await app.store.find<Friendship[]>(
        'friendships',
        {
          filter,
          include: 'friend',
          sort: '-createdAt',
          page: { offset: loadMore ? this.friends.length : 0, limit: 24 },
        },
        undefined,
        {
          // A 403 here means friendship.viewOthers is off for this actor —
          // an expected, common state (most guests/members), not a real
          // error. Swap in the "hidden" empty state instead of Flarum's
          // red permission-denied alert; anything else (network failure,
          // 500) still falls through to the default handling.
          errorHandler: (error: RequestError) => {
            if (error.status === 403) {
              this.friendsHidden = true;

              return;
            }

            return false;
          },
        }
      );
      const newFriends = results as unknown as Friendship[];

      this.friends = loadMore ? [...this.friends, ...newFriends] : newFriends;

      const meta = (results as unknown as { payload?: { meta?: any } }).payload?.meta;
      if (meta?.page?.total !== undefined) {
        this.totalCount = meta.page.total;
      } else if (meta?.total !== undefined) {
        this.totalCount = meta.total;
      } else if (!loadMore) {
        this.totalCount = this.friends.length;
      }

      this.hasMore = this.friends.length < this.totalCount;
    } catch (error) {
      if (!loadMore) {
        this.friends = [];
        this.totalCount = 0;
      }
    } finally {
      this.loading = false;
      this.loadingMore = false;
      m.redraw();
    }
  }

  content(): Mithril.Children {
    // Bare spinner, no header/search chrome, while the very first load is
    // still in flight — we don't yet know if this actor even has permission
    // to see anything, so nothing below should render prematurely (was
    // flashing the full "authorized" layout for ~500ms before friendsHidden
    // had a chance to flip on a 403).
    if (this.loading) {
      return (
        <div className="FriendsPage">
          <LoadingIndicator />
        </div>
      );
    }

    if (this.friendsHidden) {
      return (
        <div className="FriendsPage">
          <div className="FriendsPage-emptyState">
            <i className="fas fa-user-friends FriendsPage-emptyIcon"></i>
            <p>{app.translator.trans('forumaker-friendship.forum.user.friends_hidden')}</p>
          </div>
        </div>
      );
    }

    const isOwnPage = !!this.user && app.session.user?.id() === this.user.id();
    const canModerate = app.forum.attribute('canModerateFriendships') === true;
    const canOpenRequests = isOwnPage ? app.forum.attribute('canAddFriends') === true : canModerate;
    const canRemove = isOwnPage || canModerate;

    // Viewing someone else's page (via friendship.viewOthers/moderate):
    // the actor's own relationship to *that user* — not to their friends
    // listed below — same add/remove control as the profile dropdown.
    const showOwnRelationControl =
      !isOwnPage && !!this.user && !!app.session.user && (this.user.attribute('friendshipIsFriend') === true || app.forum.attribute('canAddFriends') === true);

    return (
      <div className="FriendsPage">
        <div className="FriendsPage-header">
          <h2>{app.translator.trans('forumaker-friendship.forum.user.friends_count', { count: this.totalCount })}</h2>
          <div className="FriendsPage-headerActions">
            {showOwnRelationControl && this.user && (
              <Button
                className="Button"
                icon={
                  this.user.attribute('friendshipIsFriend') === true
                    ? 'fas fa-user-minus'
                    : this.user.attribute('friendshipHasPendingOutgoing') === true
                      ? 'fas fa-ban'
                      : 'fas fa-user-plus'
                }
                onclick={() => showFriendActionModal(this.user!, { onChange: () => m.redraw() })}
              >
                {app.translator.trans(
                  this.user.attribute('friendshipIsFriend') === true
                    ? 'forumaker-friendship.forum.dropdown.remove_friend_btn'
                    : this.user.attribute('friendshipHasPendingOutgoing') === true
                      ? 'forumaker-friendship.forum.dropdown.cancel_request_btn'
                      : 'forumaker-friendship.forum.dropdown.add_friend_btn'
                )}
              </Button>
            )}
            {canOpenRequests && this.user && (
              <Button className="Button Button--primary" icon="fas fa-user-clock" onclick={() => this.showRequestsModal()}>
                {(() => {
                  const incoming = (this.user!.attribute('friendshipIncomingRequestCount') as number) || 0;
                  return incoming > 0
                    ? app.translator.trans('forumaker-friendship.forum.user.requests_btn_count', { count: incoming })
                    : app.translator.trans('forumaker-friendship.forum.user.requests_btn');
                })()}
              </Button>
            )}
          </div>
        </div>

        <input
          type="text"
          className="FormControl FriendsPage-search"
          placeholder={String(app.translator.trans('forumaker-friendship.forum.requests_modal.search_placeholder'))}
          value={this.search}
          oninput={(e: InputEvent) => this.onsearch((e.target as HTMLInputElement).value)}
        />

        {this.friends.length === 0 ? (
          <div className="FriendsPage-emptyState">
            <i className="fas fa-user-friends FriendsPage-emptyIcon"></i>
            <p>{app.translator.trans('forumaker-friendship.forum.user.no_friends')}</p>
          </div>
        ) : (
          <ul className="FriendsPage-grid">
            {this.friends.map((friendship) => {
              const friend = friendship.friend();
              if (!friend) return null;

              return (
                <li className="FriendsPage-item" key={friendship.id()}>
                  <Link href={app.route.user(friend)} className="FriendsPage-itemLink">
                    <Avatar user={friend} />
                    <div className="FriendsPage-itemInfo">
                      <span className="FriendsPage-itemName">{username(friend)}</span>
                      <span className="FriendsPage-itemDate">
                        {app.translator.trans('forumaker-friendship.forum.user.friends_since', {
                          date: dayjs(friendship.createdAt()).format('D MMMM YYYY'),
                        })}
                      </span>
                    </div>
                  </Link>
                  {canRemove && (
                    <Button
                      className="Button Button--icon Button--flat FriendsPage-itemRemove"
                      icon="fas fa-user-minus"
                      aria-label={app.translator.trans('forumaker-friendship.forum.dropdown.remove_friend_btn')}
                      onclick={() => app.modal.show(RemoveFriendConfirmModal, { user: friend, friendship, onRemoved: () => this.loadFriends() })}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {this.hasMore && (
          <div className="FriendsPage-loadMore">
            <Button className="Button" loading={this.loadingMore} onclick={() => this.loadFriends(true)}>
              {app.translator.trans('forumaker-friendship.forum.user.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  showRequestsModal(highlightRequestId?: string): void {
    if (!this.user) return;

    app.modal.show(RequestsModal, {
      user: this.user,
      onChange: () => this.loadFriends(),
      highlightRequestId,
    });
  }
}
