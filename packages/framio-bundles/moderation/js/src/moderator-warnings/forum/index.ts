import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import addWarningControl from './addWarningControl';
import addWarningPage from './addWarningPage';
import addWarningsToPosts from './addWarningsToPosts';

export { default as extend } from './extend';

app.initializers.add('fof-moderator-warnings', () => {
  addWarningControl();
  addWarningPage();
  addWarningsToPosts();

  extend('flarum/forum/components/NotificationGrid', 'notificationTypes', function (items) {
    items.add('warning', {
      name: 'warning',
      icon: 'fas fa-exclamation-circle',
      label: app.translator.trans('fof-moderator-warnings.forum.settings.warning_notification_label'),
    });
  });
});
