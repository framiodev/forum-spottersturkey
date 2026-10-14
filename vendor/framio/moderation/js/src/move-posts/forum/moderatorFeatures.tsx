import { extend } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import Post from 'flarum/forum/components/Post';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import PostControls from 'flarum/forum/utils/PostControls';
import MovePostsModal from './components/MovePostsModal';

export default function extendModeratorFeatures() {
  const selectedPosts = new Set<string>();

  extend(CommentPost.prototype, 'oninit', function () {
    this.subtree.check(() => selectedPosts.has(this.attrs.post.id() as string));
    this.subtree.check(() => selectedPosts.size > 0);
  });

extend(Post.prototype, 'classes', function (classes: string[]) {
  if (this.attrs.post.contentType() === 'comment' && selectedPosts.has(this.attrs.post.id())) {
    classes.push('Post--moving');
  }
});

extend(CommentPost.prototype, 'headerItems', function (items) {
  const postId = this.attrs.post.id();

  if (postId && selectedPosts.size > 0) {
    const isSelected = selectedPosts.has(postId);

    items.add(
      'moving',
      <Button
        className="Button Button--link PostMoving"
        onclick={() => {
          if (isSelected) {
            selectedPosts.delete(postId);
          } else {
            selectedPosts.add(postId);
          }
          m.redraw();
        }}
        icon={isSelected ? 'fas fa-check-square' : 'far fa-square'}
      >
        {app.translator.trans(`fof-move-posts.forum.post.${isSelected ? 'moving' : 'move'}`)}
      </Button>
    );
  }
});

extend(DiscussionPage.prototype, 'oncreate', () => {
  selectedPosts.clear();
});

extend(DiscussionPage.prototype, 'sidebarItems', function (items) {
  if (selectedPosts.size > 0) {
    items.add(
      'movePosts',
      <Button
        icon="fas fa-exchange-alt"
        className="Button MovePosts-Button"
        onclick={() =>
          app.modal.show(MovePostsModal, {
            postIds: Array.from(selectedPosts),
            discussion: this.discussion,
          })
        }
      >
        {app.translator.trans('fof-move-posts.forum.discussion.move_posts')}
        <span className="Bubble MovePosts-Button-count">{selectedPosts.size}</span>
      </Button>
    );
  }
});

extend(PostControls, 'moderationControls', function (items, post) {
  if (post.contentType() !== 'comment') return;

  const postId = post.id();
  if (!postId) return;

  const operation = selectedPosts.has(postId) ? 'unmove' : 'move';

  items.add(
    'movePost',
    <Button
      icon="fas fa-arrow-right"
      onclick={() => {
        if (operation === 'move') {
          selectedPosts.add(postId);
        } else {
          selectedPosts.delete(postId);
        }

        m.redraw();
      }}
    >
      {app.translator.trans(`fof-move-posts.forum.post.${operation}`)}
    </Button>
  );
});
}
