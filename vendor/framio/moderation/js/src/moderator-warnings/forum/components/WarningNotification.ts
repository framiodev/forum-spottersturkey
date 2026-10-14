import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';
import username from 'flarum/common/helpers/username';
import type Warning from '../model/Warning';

/**
 * The `WarningNotification` component displays a notification which
 * indicates that a user has been warned by a moderator.
 */
export default class WarningNotification extends Notification {
  icon() {
    return 'fas fa-exclamation-circle';
  }

  href() {
    const user = app.session.user;

    if (!user) {
      return '#';
    }

    return app.route('user.warnings', {
      username: user.username(),
    });
  }

  content() {
    const notification = this.attrs.notification;
    const warning = notification.subject() as Warning;
    const fromUser = notification.fromUser();

    if (warning.strikes()) {
      return app.translator.trans('fof-moderator-warnings.forum.notifications.warning_text', {
        mod_username: username(fromUser),
        strikes: warning.strikes() || 0,
      });
    } else {
      return app.translator.trans('fof-moderator-warnings.forum.notifications.warning_no_strikes_text', {
        mod_username: username(fromUser),
      });
    }
  }

  excerpt() {
    return null;
  }
}
