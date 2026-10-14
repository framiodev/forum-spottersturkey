import { extend } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import UserDirectoryPage from '../../user-directory/forum/components/UserDirectoryPage';
import EmailUserModal from './components/EmailUserModal';

export default function () {
  extend(UserDirectoryPage.prototype, 'actionItems', function (items) {
    if (app.forum.fofMailingCanMailAll && app.forum.fofMailingCanMailAll()) {
      items.add(
        'fof-mailing',
        Button.component(
          {
            className: 'Button',
            icon: 'fas fa-envelope',
            onclick() {
              app.modal.show(EmailUserModal, { forAll: true });
            },
          },
          app.translator.trans('framio-mailing.forum.links.mail_all')
        ),
        10
      );
    }
  });
}
