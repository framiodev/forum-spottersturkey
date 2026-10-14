import app from 'flarum/forum/app';
import addBlogControls from './addBlogControls';
import addBookmarksNavItem from './addBookmarksNavItem';
import addDiscussionBadge from './addDiscussionBadge';
import addDiscussionControls from './addDiscussionControls';
import addPostControls from './addPostControls';

export { default as extend } from './extend';

app.initializers.add('fof-bookmarks', () => {
  addDiscussionBadge();
  addDiscussionControls();
  addPostControls();
  addBookmarksNavItem();
  addBlogControls();
});
