import app from 'flarum/common/app';
import { BooleanGambit } from 'flarum/common/query/IGambit';

export default class BookmarkedGambit extends BooleanGambit {
  key(): string {
    return app.translator.trans('fof-bookmarks.lib.gambits.bookmarked.key', {}, true);
  }

  filterKey(): string {
    return 'bookmarked';
  }

  // Only registered users have bookmarks, so `is:bookmarked` is not offered to guests.
  enabled(): boolean {
    return !!app.session.user;
  }
}
