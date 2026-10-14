import { extend } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import UserControls from 'flarum/forum/utils/UserControls';
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
import EmailUserModal from './components/EmailUserModal';

export default function () {
  extend(UserControls, 'moderationControls', (items, user) => {
    if (app.forum.fofMailingCanMailIndividual && app.forum.fofMailingCanMailIndividual()) {
      items.add(
        'fof-mailing',
        Button.component(
          {
            icon: 'fas fa-envelope',
            onclick() {
              app.modal.show(EmailUserModal, { user });
            },
          },
          app.translator.trans('framio-mailing.forum.links.mail_individual')
        )
      );
    }
  });

  extend(SessionDropdown.prototype, 'items', (items) => {
    if (app.forum.fofMailingCanMailAll && app.forum.fofMailingCanMailAll()) {
      items.add(
        'fof-mailing',
        Button.component(
          {
            icon: 'fas fa-envelope',
            onclick() {
              app.modal.show(EmailUserModal, { forAll: true });
            },
          },
          app.translator.trans('framio-mailing.forum.links.mail_all')
        )
      );
    }
  });
}
