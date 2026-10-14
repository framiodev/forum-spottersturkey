import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import PostWarningList from './components/PostWarningList';

export default function addWarningsToPosts() {
  extend(CommentPost.prototype, 'footerItems', function (items) {
    const post = this.attrs.post;
    const warnings = post.warnings();

    if (!warnings) return;
    items.add(`warnings`, <PostWarningList post={post} />);
  });
}
