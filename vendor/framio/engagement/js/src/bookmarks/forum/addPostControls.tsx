import { extend } from 'flarum/common/extend';
import Icon from 'flarum/common/components/Icon';
import type Post from 'flarum/common/models/Post';
import app from 'flarum/forum/app';
import CommentPost from 'flarum/forum/components/CommentPost';
import PostControls from 'flarum/forum/utils/PostControls';
import BookmarkButton from './components/BookmarkButton';

type ButtonPosition = 'header' | 'actions' | 'menu';

/**
 * Where the admin has chosen to show the post bookmark control.
 *
 * A default is registered in extend.php, so this is always one of the three positions.
 */
function buttonPosition(): ButtonPosition {
  return app.forum.attribute<ButtonPosition>('fof-bookmarks.postButtonPosition');
}

export default function addPostControls(): void {
  extend(CommentPost.prototype, 'headerItems', function (items) {
    const post = this.attrs.post as Post;

    if (buttonPosition() === 'header') {
      if (!app.session.user) return;

      items.add('bookmark', <BookmarkButton subject={post} labels="postButton" className="Button Button--link Button--bookmark-post" alert />);

      return;
    }

    // With the button moved elsewhere, an optional label keeps bookmarked posts
    // recognisable while scrolling.
    if (app.forum.attribute('fof-bookmarks.postHeaderBadge') && post.bookmarked()) {
      items.add(
        'bookmark',
        <span className="BookmarkedPostLabel">
          <Icon name="fas fa-bookmark" /> {app.translator.trans('fof-bookmarks.forum.badge')}
        </span>
      );
    }
  });

  extend(CommentPost.prototype, 'actionItems', function (items) {
    if (!app.session.user || buttonPosition() !== 'actions') return;

    items.add('bookmark', <BookmarkButton subject={this.attrs.post as Post} labels="postButton" className="Button Button--link" alert />);
  });

  extend(PostControls, 'userControls', function (items, post: Post) {
    if (!app.session.user || buttonPosition() !== 'menu') return;

    // No `className`: dropdown items are styled by the menu, and core's own PostControls
    // entries (Edit, Flag, Delete) pass none either. Adding `Button` here indents the row.
    items.add('bookmark', <BookmarkButton subject={post} labels="postButton" alert />);
  });
}
