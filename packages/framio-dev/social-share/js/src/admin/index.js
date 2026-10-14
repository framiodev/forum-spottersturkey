import app from 'flarum/admin/app';
import SocialShareSettingsPage from './components/SocialShareSettingsPage';

app.initializers.add('framio-social-share', () => {
  app.registry
    .for('framio-social-share')
    .registerPage(SocialShareSettingsPage)
    .registerPermission(
      {
        icon: 'fab fa-instagram',
        label: 'Sosyal Medyada Paylaş (Meta Business Suite)',
        permission: 'framio-social-share.share-posts',
      },
      'moderate'
    )
    .registerPermission(
      {
        icon: 'fas fa-mobile-alt',
        label: 'Hikaye Tasarla & İndir (Story Oluşturucu)',
        permission: 'framio-social-share.create-stories',
      },
      'moderate'
    )
    .registerPermission(
      {
        icon: 'fas fa-paper-plane',
        label: 'Hikaye Yayınla & Zamanla (Instagram & Facebook Story)',
        permission: 'framio-social-share.publish-stories',
      },
      'moderate'
    );
});