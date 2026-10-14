import app from 'flarum/forum/app';
import { debounce } from 'flarum/common/utils/throttleDebounce';
import type { Channel } from 'pusher-js';
import RealtimeState from 'ext:flarum/realtime/forum/RealtimeState';

import onlineUsersState from '../common/onlineUsersState';

/**
 * Presence is used purely as an invalidation signal. The server remains the
 * single source of truth for who is online and what may be shown of them.
 *
 * It is tempting to render the presence roster directly — it is, after all, an
 * exact list of who holds a socket right now. But presence membership is the
 * *subscriber* list, and subscribing requires `viewOnlineUsersWidget`. On a
 * forum where that permission is restricted, the roster is not "everyone
 * online", it is "everyone online who may view the widget" — a far smaller set.
 * Treating it as authoritative therefore made the list collapse the moment the
 * socket connected: the page payload counted every recently-active user, then
 * the roster replaced it with the handful of permitted subscribers.
 *
 * The client also cannot filter a roster correctly even when it is complete: it
 * cannot apply the visibility scope, cannot honour the `discloseOnline`
 * preference (the presence payload carries only a display name), and cannot
 * apply the `max_users` cap the `+N` chip is derived from.
 *
 * So membership changes only tell us "something moved, ask again". The rendered
 * list is always the server's answer, which means it never changes definition
 * underneath the viewer.
 */

/**
 * Refetch the forum resource, which carries `onlineUsers` and
 * `totalOnlineUsers` as a default include.
 *
 * `store.find('forum')` cannot be used: it would build `apiUrl + '/forum'`,
 * whereas the forum resource is served from the API root (`GET /`, see
 * ForumResource::endpoints()). Pushing the payload replaces the `onlineUsers`
 * relationship wholesale rather than merging into it, so users correctly
 * disappear once the server stops returning them.
 */
async function refetchOnlineUsers(): Promise<void> {
  onlineUsersState.isLoading = true;

  try {
    const payload = await app.request<any>({
      method: 'GET',
      url: app.forum.attribute<string>('apiUrl') + '/',
    });

    app.store.pushPayload(payload);
  } finally {
    onlineUsersState.isLoading = false;
    m.redraw();
  }
}

/**
 * Membership churn arrives one event per user and a single navigation can
 * produce several in a row, so coalesce them into one request. The server-side
 * cache (`cache_ttl`) absorbs the rest.
 */
const scheduleRefetch = debounce(2000, () => {
  refetchOnlineUsers();
});

/**
 * Channel-ready callbacks re-fire on every reconnect cycle (iOS backgrounding,
 * desktop Safari zombie sockets — see realtime's Application.ts forceReconnect),
 * each time handing over a fresh channel object. Re-binding on the new channel
 * is required; re-binding on one we already hold would stack duplicate
 * handlers, so track the channel we last bound to.
 */
let boundChannel: Channel | null = null;

function subscribeToPresence(): void {
  // Presence auth refuses guests outright, so there is nothing to subscribe to.
  if (!app.session.user) return;

  if (!app.forum.attribute<boolean>('canViewOnlineUsersWidget')) return;

  const channel: Channel = app.websocket.subscribe('presence-online');

  if (channel === boundChannel) return;

  boundChannel = channel;

  // No handler for `pusher:subscription_succeeded`: the page payload is already
  // the server's answer, so there is nothing to correct on connect. Refetching
  // there is what produced the visible collapse.
  channel.bind('pusher:member_added', scheduleRefetch);
  channel.bind('pusher:member_removed', scheduleRefetch);
}

/**
 * Only called when flarum-realtime is enabled — see the guard in forum/index.ts.
 * The `ext:` import above compiles to a webpack external whose factory runs on
 * first require, so nothing is resolved on forums without realtime installed.
 */
export default function extendRealtime(): void {
  // Logged-in users get a private user channel; guests get the public one.
  // Either firing means Pusher is connected and app.forum is populated.
  RealtimeState.onUserChannelReady(subscribeToPresence);
  RealtimeState.onPublicChannelReady(subscribeToPresence);
}
