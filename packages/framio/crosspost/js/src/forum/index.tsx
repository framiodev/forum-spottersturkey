import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import PostControls from 'flarum/forum/utils/PostControls';
import Button from 'flarum/common/components/Button';
import CrosspostBadge from './components/CrosspostBadge';
import CrosspostModal from './components/CrosspostModal';

app.initializers.add('framio-network-crosspost', () => {
  // Gönderi altına intisap / kaynak rozeti ekleme
  extend(CommentPost.prototype, 'footerItems', function (items) {
    const post = this.attrs.post;
    if (!post) return;

    const discussion = post.discussion && typeof post.discussion === 'function' ? post.discussion() : null;
    const hasPlatform = post.attribute('crosspostSourcePlatform') || (discussion && discussion.attribute('crosspostSourcePlatform'));

    if (hasPlatform) {
      // Yalnızca tartışmanın ilk mesajında veya bağımsız aktarılan mesajlarda göster
      if (post.number() === 1 || post.attribute('crosspostSourcePlatform')) {
        items.add(
          'crosspost-attribution',
          <CrosspostBadge post={post} />,
          -50
        );
      }
    }
  });

  // 1. Tartışma menüsüne (3 nokta) "Konuyu Ağa Aktar" butonunu ekleme
  extend(DiscussionControls, 'moreControls', function (items, discussion) {
    const actor = app.session.user;
    if (!actor) return;

    // Yönetici veya yetkili kullanıcılar için butonu göster
    if (actor.isAdmin() || actor.hasPermission('discussion.crosspost')) {
      items.add(
        'crosspost-network',
        <Button
          icon="fas fa-network-wired"
          onclick={() => {
            app.modal.show(CrosspostModal, { discussion });
          }}
        >
          {app.translator.trans('framio-network-crosspost.forum.crosspost_button')}
        </Button>,
        5
      );
    }
  });

  // 2. Mesaj / Gönderi menüsüne (3 nokta) "Mesajı Ağa Aktar" butonunu ekleme
  extend(PostControls, 'userControls', function (items, post) {
    const actor = app.session.user;
    if (!actor) return;

    // Sadece yorum/içerik mesajlarında göster
    if (post.contentType && post.contentType() !== 'comment') return;

    if (actor.isAdmin() || actor.hasPermission('discussion.crosspost')) {
      items.add(
        'crosspost-post',
        <Button
          icon="fas fa-network-wired"
          onclick={() => {
            app.modal.show(CrosspostModal, { post });
          }}
        >
          Mesajı Ağa Aktar
        </Button>,
        10
      );
    }
  });
});
