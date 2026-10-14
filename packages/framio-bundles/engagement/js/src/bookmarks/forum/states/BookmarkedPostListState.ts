import type { PaginatedListRequestParams } from 'flarum/common/states/PaginatedListState';
import PostListState from 'flarum/forum/states/PostListState';

/**
 * Paginated list of the actor's bookmarked posts, newest first.
 *
 * Core's `PostListState` already provides everything but the `include` handling below: it
 * defaults to `filter.type: 'comment'` — the bookmark button is only ever attached to
 * `CommentPost`, and event posts (renames, locks) have no content worth listing — and to
 * `sort: '-createdAt'`.
 */
export default class BookmarkedPostListState extends PostListState {
  constructor() {
    // Core types filter values as strings, and they are serialized into the query string
    // either way, so the flag is sent as '1' rather than a boolean.
    super({ filter: { bookmarked: '1' } }, 1, 20);
  }

  requestParams(): PaginatedListRequestParams {
    const params = super.requestParams();

    // No `include` is sent on purpose.
    //
    // A client-supplied `include` *replaces* the endpoint's `defaultInclude` rather than
    // merging with it (see json-api-server's `IncludesData::getInclude()`). Sending core's
    // `['user', 'discussion']` would therefore drop the rest of the Index endpoint's
    // defaults (`user.groups`, `editedUser`, `hiddenUser`) along with every relationship
    // other extensions add, such as fof/geoip's `ip_info`. Those extensions then render
    // against a relationship that was never loaded.
    delete params.include;

    return params;
  }
}
