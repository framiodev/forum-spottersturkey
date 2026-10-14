import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import CommentPost from 'flarum/forum/components/CommentPost';
import Signature from './components/Signature';

export default function extendCommentPost() {
    extend(CommentPost.prototype, 'footerItems', function (items) {
      if (app.current.matches(DiscussionPage)) {
        if (this.attrs.post.user?.() && this.attrs.post.number()===1) {
          if (this.attrs.post.user().signature()) {
            const allowInlineEditing = app.forum.attribute('allowInlineEditing') || false;
            
            items.add(
              'signature',
              [
                <Signature user={this.attrs.post.user()} readonly={!allowInlineEditing} />
              ],
              -999
            );
            // content.push(
            //   <div className="Post-signature">
            //     <Signature user={this.attrs.post.user()} readonly={!allowInlineEditing} />
            //   </div>
            // );
          }
        }
      }
    });
}
