import app from 'flarum/forum/app';
import HeaderDropdown from 'flarum/forum/components/HeaderDropdown';
import classList from 'flarum/common/utils/classList';
import type DraftsListState from '../states/DraftsListState';
import DraftsList from './DraftsList';

export default class DraftsDropdown extends HeaderDropdown {
  static initAttrs(attrs: any) {
    attrs.className = classList('DraftsDropdown', attrs.className);
    attrs.label = attrs.label || app.translator.trans('fof-drafts.forum.dropdown.tooltip');
    attrs.icon = attrs.icon || 'fas fa-feather-pointed';

    super.initAttrs(attrs);
  }

  oninit(vnode: any) {
    super.oninit(vnode);

    if (app.session?.user && this.attrs.state && !app.cache.draftsLoaded) {
      this.attrs.state.load();
    }
  }

  getContent() {
    return <DraftsList state={this.attrs.state as DraftsListState} />;
  }

  goToRoute() {
    m.route.set(app.route('drafts'));
  }

  getUnreadCount(): number {
    if (app.cache.draftsLoaded) {
      return app.store.all('drafts').length;
    }

    const user = app.session.user;
    if (!user) return 0;

    if (typeof (user as any).draftCount === 'function') {
      return (user as any).draftCount() || 0;
    }

    return (user.attribute('draftCount') as number) || 0;
  }

  getNewCount(): number {
    // We return 0 here so that the drafts dropdown doesn't always show a new count (usually highlighted in the forum primary color).
    return 0;
  }
}
