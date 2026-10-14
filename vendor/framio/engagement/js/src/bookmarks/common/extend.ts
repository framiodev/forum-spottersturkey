import Extend from 'flarum/common/extenders';

import BookmarkedGambit from './gambits/BookmarkedGambit';

export default [
  // Gambits moved from the backend to the frontend in Flarum 2.0: the PHP side now only
  // exposes a `bookmarked` filter, and this is what turns `is:bookmarked` typed into the
  // search box into that filter.
  //
  // Registered in the common frontend because gambits are used by both the forum and
  // admin frontends.
  //
  // Registered for both model types, mirroring the backend: `bookmarked` filters are added
  // to the discussion searcher and the post searcher alike, and the gambit resolves to the
  // same filter key on each, so one class serves both.
  new Extend.Search() //
    .gambit('discussions', BookmarkedGambit)
    .gambit('posts', BookmarkedGambit),
];
