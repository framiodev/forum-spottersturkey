import app from 'flarum/forum/app';
import UserPage from 'flarum/forum/components/UserPage';
import WarningList from './WarningList';
import type Mithril from 'mithril';

export default class WarningPage extends UserPage {
  oninit(vnode: Mithril.Vnode) {
    super.oninit(vnode);

    this.loadUser(m.route.param('username'));
  }

  content() {
    if (
      app.session.user &&
      (app.session.user.canViewWarnings() || (this.user && this.user.id() === app.session.user.id() && this.user.visibleWarningCount() > 0))
    ) {
      return (
        <div className="WarningsUserPage">
          <WarningList
            params={{
              user: this.user,
              sort: 'newest',
            }}
          />
        </div>
      );
    }

    return <></>;
  }
}
