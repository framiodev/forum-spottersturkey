import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserPage from 'flarum/forum/components/UserPage';
import LinkButton from 'flarum/common/components/LinkButton';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

export default function addWarningPage() {
  extend(UserPage.prototype, 'navItems', function (items: ItemList<Mithril.Children>) {
    const user = this.user;

    // canViewWarnings is relative to the profile user: true for moderators on
    // any profile, but also always true on the actor's own profile. So on
    // one's own profile, only show the link once there are visible warnings.
    const isSelf = user && app.session.user && user.id() === app.session.user.id();

    // This item's children are rendered twice by UserPage's SelectDropdown nav (menu item
    // + toggle label) whenever it is the active page, so its structure must never change
    // while mounted: the badge is hidden at zero rather than removed, and the item stays
    // registered while its page is being viewed.
    const viewingWarnings = app.current.get('routeName') === 'user.warnings';

    if (app.session.user && user && user.canViewWarnings() && (!isSelf || viewingWarnings || user.visibleWarningCount() > 0)) {
      const count = user.visibleWarningCount() ?? 0;

      items.add(
        'warnings',
        <LinkButton
          href={app.route('user.warnings', {
            username: user.slug(),
          })}
          icon="fas fa-exclamation-circle"
        >
          {app.translator.trans('fof-moderator-warnings.forum.user.warnings')}
          <span className="Button-badge" style={count > 0 ? undefined : { display: 'none' }}>
            {count || ''}
          </span>
        </LinkButton>,
        10
      );
    }
  });
}
