import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import HighlightNotification from './HighlightNotification';

app.initializers.add('framio-community-broadcast', () => {
  app.notificationComponents.communityHighlight = HighlightNotification;

  // Üyenin bildirim ayarlarında (site içi / tarayıcı / e-posta) açıp kapatabilmesi için
  extend('flarum/forum/components/NotificationGrid', 'notificationTypes', function (items) {
    items.add('communityHighlight', {
      name: 'communityHighlight',
      icon: 'fas fa-bullhorn',
      label: app.translator.trans('framio-notifications.forum.settings_label'),
    });
  });
});
