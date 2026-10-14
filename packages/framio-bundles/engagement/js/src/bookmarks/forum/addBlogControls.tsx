import { extend } from 'flarum/common/extend';
import type Discussion from 'flarum/common/models/Discussion';
import app from 'flarum/forum/app';
import BookmarkButton from './components/BookmarkButton';

/**
 * fof/blog's article page does not reuse Flarum's discussion sidebar, so the bookmark
 * control has to be added to its own content list.
 *
 * The target is given to `extend()` as an `ext:` module path rather than a class. That
 * defers the extension through `flarum.reg.onLoad()`, so it is applied if and when
 * fof/blog loads and is simply never applied when blog is not installed — which is what
 * keeps blog an optional dependency without a runtime import.
 */
export default function addBlogControls(): void {
  extend('ext:fof/blog/forum/pages/BlogItem', 'contentItems', function (this: any, items: any) {
    if (!app.session.user) return;

    // `article` is protected on BlogItem, but this runs as an extension of the class.
    const article = this.article as Discussion | null;

    if (!article) return;

    items.add(
      'bookmark',
      <div className="FlarumBlog-Article-Content-Bookmark-Button">
        <BookmarkButton subject={article} labels="independentButton" className="Button Button--bookmark" />
      </div>,
      // Just below the edit controls an admin may see.
      78
    );
  });
}
