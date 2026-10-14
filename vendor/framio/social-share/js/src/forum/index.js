import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import PostControls from 'flarum/forum/utils/PostControls';
import Button from 'flarum/common/components/Button';
import SocialActionChooserModal from './components/SocialActionChooserModal';
import ShareModal from './components/ShareModal';
import StoryModal from './components/StoryModal';

app.initializers.add('framio-social-share', () => {
  extend(PostControls, 'moderationControls', function (items, post) {
    if (!app.session.user) return;

    const user = app.session.user;
    const isForumAdmin = user.isAdmin();
    
    // Spesifik yetkili kullanıcı adları ve ID'leri
    const allowedShareUsersStr = app.forum.attribute('framio-social-share.allowed_share_users') || '';
    const allowedStoryUsersStr = app.forum.attribute('framio-social-share.allowed_story_users') || '';
    const allowedStoryPublishUsersStr = app.forum.attribute('framio-social-share.allowed_story_publish_users') || '';

    const allowedShareUsers = allowedShareUsersStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const allowedStoryUsers = allowedStoryUsersStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const allowedStoryPublishUsers = allowedStoryPublishUsersStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    const currentUsername = (user.username() || '').toLowerCase();
    const currentUserId = String(user.id());

    const isSpecificShareUser = allowedShareUsers.includes(currentUsername) || allowedShareUsers.includes(currentUserId);
    const isSpecificStoryUser = allowedStoryUsers.includes(currentUsername) || allowedStoryUsers.includes(currentUserId);
    const isSpecificStoryPublishUser = allowedStoryPublishUsers.includes(currentUsername) || allowedStoryPublishUsers.includes(currentUserId);

    // Grup İzni VEYA Spesifik Kullanıcı VEYA Admin
    const canShare = isForumAdmin || user.hasPermission('framio-social-share.share-posts') || isSpecificShareUser;
    const canStory = isForumAdmin || user.hasPermission('framio-social-share.create-stories') || user.hasPermission('framio-social-share.publish-stories') || isSpecificStoryUser || isSpecificStoryPublishUser;

    if (!canShare && !canStory) return;

    const content = post.contentHtml();
    const div = document.createElement('div');
    div.innerHTML = content;
    const images = [];

    // 1. Önce <a> etiketleri içindeki büyük boy görselleri topla
    div.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (/\.(jpe?g|png|webp|gif)($|\?)/i.test(href)) {
        if (!images.includes(href)) images.push(href);
      }
    });

    // 2. Eğer <a> yoksa doğrudan <img> etiketlerini al
    div.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src') || '';
      if (src) {
        const parentA = img.closest('a');
        const parentHref = parentA ? parentA.getAttribute('href') : null;
        if (!parentHref || !/\.(jpe?g|png|webp|gif)($|\?)/i.test(parentHref)) {
          if (!images.includes(src)) images.push(src);
        }
      }
    });

    if (images.length > 0) {
      items.add('framio-social-hub', Button.component({
        icon: 'fas fa-share-alt',
        onclick: () => {
          if (canShare && canStory) {
            app.modal.show(SocialActionChooserModal, { 
              post: post, 
              images: images,
              canShare: canShare,
              canStory: canStory
            });
          } else if (canShare) {
            app.modal.show(ShareModal, {
              post: post,
              images: images,
              canGoBack: false
            });
          } else if (canStory) {
            app.modal.show(StoryModal, {
              post: post,
              images: images,
              imageUrl: images[0],
              canGoBack: false
            });
          }
        },
      }, 'Sosyal Medyada Paylaş'));
    }
  });
});